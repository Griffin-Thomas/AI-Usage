use crate::error::{AppError, ProviderError};
use crate::models::UsageData;
use crate::providers::{ClaudeProvider, UsageProvider};
use crate::services::{
    CredentialService, HistoryService, NotificationService, NotificationState, SettingsService,
};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex as AsyncMutex;
use tokio::time::sleep;

/// Minimum time between requests (rate limit protection)
const MIN_REFRESH_INTERVAL_SECS: u64 = 10;

/// If we detect a gap larger than this, assume system was sleeping
const SLEEP_DETECTION_THRESHOLD_SECS: u64 = 30;

/// Scheduler state shared across the app
pub struct SchedulerState {
    /// Whether the scheduler is currently running
    running: AtomicBool,
    /// Last fetch timestamp (unix millis)
    last_fetch: AtomicU64,
    /// Current interval in seconds
    interval_secs: AtomicU64,
    /// Lock for fetch operations to prevent concurrent requests
    fetch_lock: AsyncMutex<()>,
    /// Previous usage data for detecting resets
    previous_usage: AsyncMutex<Option<UsageData>>,
    /// Notification state for tracking sent notifications
    notification_state: NotificationState,
}

impl Default for SchedulerState {
    fn default() -> Self {
        Self {
            running: AtomicBool::new(false),
            last_fetch: AtomicU64::new(0),
            interval_secs: AtomicU64::new(300), // Default 5 minutes
            fetch_lock: AsyncMutex::new(()),
            previous_usage: AsyncMutex::new(None),
            notification_state: NotificationState::new(),
        }
    }
}

impl SchedulerState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn set_running(&self, running: bool) {
        self.running.store(running, Ordering::SeqCst);
    }

    pub fn get_interval(&self) -> u64 {
        self.interval_secs.load(Ordering::SeqCst)
    }

    pub fn set_interval(&self, secs: u64) {
        self.interval_secs.store(secs, Ordering::SeqCst);
    }

    pub fn get_last_fetch(&self) -> u64 {
        self.last_fetch.load(Ordering::SeqCst)
    }

    pub fn set_last_fetch(&self, millis: u64) {
        self.last_fetch.store(millis, Ordering::SeqCst);
    }

    /// Check if enough time has passed since last fetch (rate limiting)
    pub fn can_fetch(&self) -> bool {
        let last = self.get_last_fetch();
        if last == 0 {
            return true;
        }
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let elapsed_secs = (now - last) / 1000;
        elapsed_secs >= MIN_REFRESH_INTERVAL_SECS
    }
}

/// Event payload for usage updates
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageUpdateEvent {
    pub provider: String,
    pub data: Option<UsageData>,
    pub error: Option<String>,
}

/// Event payload for scheduler status
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchedulerStatusEvent {
    pub running: bool,
    pub interval_secs: u64,
    pub next_refresh_secs: Option<u64>,
}

pub struct SchedulerService;

impl SchedulerService {
    /// Start the background scheduler
    pub fn start(app: AppHandle, state: Arc<SchedulerState>) {
        if state.is_running() {
            log::info!("Scheduler already running");
            return;
        }

        state.set_running(true);
        log::info!("Starting background refresh scheduler");

        // Load initial interval from settings
        if let Ok(settings) = SettingsService::get(&app) {
            state.set_interval(settings.refresh_interval as u64);
        }

        let app_clone = app.clone();
        let state_clone = state.clone();

        tauri::async_runtime::spawn(async move {
            Self::scheduler_loop(app_clone, state_clone).await;
        });

        // Emit status update
        let _ = app.emit(
            "scheduler-status",
            SchedulerStatusEvent {
                running: true,
                interval_secs: state.get_interval(),
                next_refresh_secs: Some(state.get_interval()),
            },
        );
    }

    /// Stop the background scheduler
    pub fn stop(app: &AppHandle, state: &SchedulerState) {
        if !state.is_running() {
            log::info!("Scheduler not running");
            return;
        }

        state.set_running(false);
        log::info!("Stopping background refresh scheduler");

        // Emit status update
        let _ = app.emit(
            "scheduler-status",
            SchedulerStatusEvent {
                running: false,
                interval_secs: state.get_interval(),
                next_refresh_secs: None,
            },
        );
    }

    /// Update the refresh interval
    pub fn set_interval(app: &AppHandle, state: &SchedulerState, secs: u64) {
        let interval = secs.max(MIN_REFRESH_INTERVAL_SECS);
        state.set_interval(interval);
        log::info!("Updated refresh interval to {} seconds", interval);

        // Emit status update
        let _ = app.emit(
            "scheduler-status",
            SchedulerStatusEvent {
                running: state.is_running(),
                interval_secs: interval,
                next_refresh_secs: if state.is_running() {
                    Some(interval)
                } else {
                    None
                },
            },
        );
    }

    /// Force an immediate refresh (respects rate limiting)
    pub async fn force_refresh(app: &AppHandle, state: &SchedulerState) -> Result<(), AppError> {
        if !state.can_fetch() {
            log::warn!("Rate limited: too soon since last fetch");
            return Err(AppError::RateLimit(
                "Please wait before refreshing again".to_string(),
            ));
        }

        Self::fetch_and_emit(app, state).await;
        Ok(())
    }

    /// Main scheduler loop
    async fn scheduler_loop(app: AppHandle, state: Arc<SchedulerState>) {
        let mut last_check = Instant::now();
        let mut last_tick = Instant::now();

        while state.is_running() {
            let interval = state.get_interval();
            let elapsed = last_check.elapsed().as_secs();

            // Detect if system was sleeping (time gap much larger than expected)
            let tick_elapsed = last_tick.elapsed().as_secs();
            if tick_elapsed > SLEEP_DETECTION_THRESHOLD_SECS {
                log::info!(
                    "Detected system wake ({}s gap), refreshing immediately",
                    tick_elapsed
                );
                // System just woke up - refresh immediately
                Self::fetch_and_emit(&app, &state).await;
                last_check = Instant::now();

                // Emit wake event to frontend
                let _ = app.emit("system-wake", ());
            } else if elapsed >= interval {
                // Normal scheduled fetch
                Self::fetch_and_emit(&app, &state).await;
                last_check = Instant::now();
            }

            last_tick = Instant::now();

            // Sleep for a short interval to check for stop signals and detect wake
            sleep(Duration::from_secs(1)).await;
        }

        log::info!("Scheduler loop ended");
    }

    /// Fetch usage data and emit to frontend
    async fn fetch_and_emit(app: &AppHandle, state: &SchedulerState) {
        // Try to acquire the fetch lock (non-blocking)
        let _lock = match state.fetch_lock.try_lock() {
            Ok(lock) => lock,
            Err(_) => {
                log::debug!("Fetch already in progress, skipping");
                return;
            }
        };

        // Drop the lock before any async operations to avoid Send issues
        drop(_lock);

        // Re-acquire the lock for the actual fetch
        let _lock = state.fetch_lock.lock().await;

        // Check rate limit
        if !state.can_fetch() {
            log::debug!("Rate limited, skipping fetch");
            return;
        }

        log::info!("Scheduler fetching usage data");

        // Update last fetch time
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        state.set_last_fetch(now);

        // Fetch for Claude provider (main provider for now)
        let result = Self::fetch_provider_usage(app, "claude").await;

        let event = match result {
            Ok(data) => {
                // Adaptive refresh: adjust interval based on usage level
                Self::maybe_adjust_interval(app, state, &data);

                // Process notifications (get previous usage first)
                let previous_data = {
                    let previous = state.previous_usage.lock().await;
                    previous.clone()
                };

                NotificationService::process_usage(
                    app,
                    &state.notification_state,
                    &data,
                    previous_data.as_ref(),
                );

                // Check for upcoming resets
                for limit in &data.limits {
                    NotificationService::check_upcoming_reset(
                        app,
                        &state.notification_state,
                        limit,
                    );
                }

                // Save to history
                if let Err(e) = HistoryService::add_entry(app, &data) {
                    log::warn!("Failed to save usage to history: {}", e);
                }

                // Store current usage as previous for next comparison
                {
                    let mut previous = state.previous_usage.lock().await;
                    *previous = Some(data.clone());
                }

                UsageUpdateEvent {
                    provider: "claude".to_string(),
                    data: Some(data),
                    error: None,
                }
            }
            Err(e) => {
                log::error!("Failed to fetch usage: {}", e);

                // Check if this is a session expiry error
                let error_str = e.to_string();
                if error_str.contains("expired") || error_str.contains("401") {
                    NotificationService::send_session_expiry_warning(app);
                }

                UsageUpdateEvent {
                    provider: "claude".to_string(),
                    data: None,
                    error: Some(error_str),
                }
            }
        };

        // Emit to frontend
        let _ = app.emit("usage-update", event);
    }

    /// Fetch usage for a specific provider
    async fn fetch_provider_usage(app: &AppHandle, provider: &str) -> Result<UsageData, AppError> {
        let credentials = CredentialService::get(app, provider)?
            .ok_or_else(|| ProviderError::MissingCredentials(provider.to_string()))?;

        match provider {
            "claude" => {
                let claude = ClaudeProvider::new()?;

                if !claude.validate_credentials(&credentials) {
                    return Err(ProviderError::InvalidCredentials(
                        "Missing org_id or session_key".to_string(),
                    )
                    .into());
                }

                claude.fetch_usage(&credentials).await.map_err(|e| e.into())
            }
            _ => Err(ProviderError::HttpError(format!("Unknown provider: {}", provider)).into()),
        }
    }

    /// Adjust interval based on usage level (adaptive refresh)
    fn maybe_adjust_interval(app: &AppHandle, state: &SchedulerState, data: &UsageData) {
        // Get settings to check if adaptive mode is enabled
        let settings = match SettingsService::get(app) {
            Ok(s) => s,
            Err(_) => return,
        };

        if settings.refresh_mode != "adaptive" {
            return;
        }

        // Find the highest utilization (already a percentage 0-100 from API)
        let max_utilization = data
            .limits
            .iter()
            .map(|l| l.utilization)
            .fold(0.0_f64, |a, b| a.max(b));

        // Determine new interval based on usage level (utilization is 0-100)
        let new_interval = if max_utilization >= 90.0 {
            // Very high usage: check every minute
            60
        } else if max_utilization >= 75.0 {
            // High usage: check every 3 minutes
            180
        } else if max_utilization >= 50.0 {
            // Medium usage: check every 5 minutes
            300
        } else {
            // Low usage: check every 10 minutes
            600
        };

        let current_interval = state.get_interval();
        if new_interval != current_interval {
            log::info!(
                "Adaptive refresh: adjusting interval from {}s to {}s (usage: {:.0}%)",
                current_interval,
                new_interval,
                max_utilization
            );
            state.set_interval(new_interval);

            // Emit status update
            let _ = app.emit(
                "scheduler-status",
                SchedulerStatusEvent {
                    running: state.is_running(),
                    interval_secs: new_interval,
                    next_refresh_secs: Some(new_interval),
                },
            );
        }
    }
}
