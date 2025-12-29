use crate::error::{AppError, ProviderError};
use crate::models::{Account, UsageData};
use crate::providers::{ClaudeProvider, UsageProvider};
use crate::services::{
    CredentialService, HistoryService, NotificationService, NotificationState, SettingsService,
};
use std::collections::HashMap;
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
    /// Whether the scheduler is paused due to session issues (per account)
    paused_accounts: AsyncMutex<HashMap<String, bool>>,
    /// Count of consecutive session errors per account
    session_error_counts: AsyncMutex<HashMap<String, u64>>,
    /// Last fetch timestamp (unix millis)
    last_fetch: AtomicU64,
    /// Current interval in seconds
    interval_secs: AtomicU64,
    /// Lock for fetch operations to prevent concurrent requests
    fetch_lock: AsyncMutex<()>,
    /// Previous usage data for detecting resets (per account)
    previous_usage: AsyncMutex<HashMap<String, UsageData>>,
    /// Notification state for tracking sent notifications (account-aware)
    notification_state: NotificationState,
}

/// Maximum consecutive session errors before pausing
const MAX_SESSION_ERRORS: u64 = 3;

/// Event payload for session status
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatusEvent {
    pub account_id: String,
    pub valid: bool,
    pub error_count: u64,
    pub paused: bool,
}

impl Default for SchedulerState {
    fn default() -> Self {
        Self {
            running: AtomicBool::new(false),
            paused_accounts: AsyncMutex::new(HashMap::new()),
            session_error_counts: AsyncMutex::new(HashMap::new()),
            last_fetch: AtomicU64::new(0),
            interval_secs: AtomicU64::new(300), // Default 5 minutes
            fetch_lock: AsyncMutex::new(()),
            previous_usage: AsyncMutex::new(HashMap::new()),
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

    /// Check if an account is paused
    pub async fn is_account_paused(&self, account_id: &str) -> bool {
        let paused = self.paused_accounts.lock().await;
        paused.get(account_id).copied().unwrap_or(false)
    }

    /// Set pause status for an account
    pub async fn set_account_paused(&self, account_id: &str, paused: bool) {
        let mut map = self.paused_accounts.lock().await;
        map.insert(account_id.to_string(), paused);
    }

    /// Check if any account is paused
    pub async fn any_account_paused(&self) -> bool {
        let paused = self.paused_accounts.lock().await;
        paused.values().any(|&p| p)
    }

    /// Get session error count for an account
    pub async fn get_account_error_count(&self, account_id: &str) -> u64 {
        let counts = self.session_error_counts.lock().await;
        counts.get(account_id).copied().unwrap_or(0)
    }

    /// Increment and return session error count for an account
    pub async fn increment_account_error_count(&self, account_id: &str) -> u64 {
        let mut counts = self.session_error_counts.lock().await;
        let count = counts.entry(account_id.to_string()).or_insert(0);
        *count += 1;
        *count
    }

    /// Reset session error count for an account
    pub async fn reset_account_error_count(&self, account_id: &str) {
        let mut counts = self.session_error_counts.lock().await;
        counts.insert(account_id.to_string(), 0);
    }

    /// Clear all account paused states and error counts
    pub async fn reset_all_account_states(&self) {
        let mut paused = self.paused_accounts.lock().await;
        paused.clear();
        let mut counts = self.session_error_counts.lock().await;
        counts.clear();
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

    /// Get previous usage for an account
    pub async fn get_previous_usage(&self, account_id: &str) -> Option<UsageData> {
        let previous = self.previous_usage.lock().await;
        previous.get(account_id).cloned()
    }

    /// Set previous usage for an account
    pub async fn set_previous_usage(&self, account_id: &str, data: UsageData) {
        let mut previous = self.previous_usage.lock().await;
        previous.insert(account_id.to_string(), data);
    }
}

/// Event payload for usage updates
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageUpdateEvent {
    pub provider: String,
    pub account_id: String,
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
                // System just woke up - refresh immediately (even if paused, to check if session is valid again)
                Self::fetch_all_accounts(&app, &state).await;
                last_check = Instant::now();

                // Emit wake event to frontend
                let _ = app.emit("system-wake", ());
            } else if elapsed >= interval {
                // Normal scheduled fetch
                Self::fetch_all_accounts(&app, &state).await;
                last_check = Instant::now();
            }

            last_tick = Instant::now();

            // Sleep for a short interval to check for stop signals and detect wake
            sleep(Duration::from_secs(1)).await;
        }

        log::info!("Scheduler loop ended");
    }

    /// Fetch usage for all accounts and emit events
    async fn fetch_all_accounts(app: &AppHandle, state: &SchedulerState) {
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

        // Update last fetch time
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        state.set_last_fetch(now);

        // Get all Claude accounts
        let accounts = match CredentialService::list_accounts(app, "claude") {
            Ok(accounts) => accounts,
            Err(e) => {
                log::error!("Failed to list accounts: {}", e);
                return;
            }
        };

        if accounts.is_empty() {
            log::debug!("No accounts configured, skipping fetch");
            return;
        }

        log::info!("Scheduler fetching usage for {} account(s)", accounts.len());

        // Track max utilization across all accounts for adaptive refresh
        let mut max_utilization_overall: f64 = 0.0;

        // Fetch for each account sequentially (to respect rate limits)
        for account in accounts {
            // Skip paused accounts
            if state.is_account_paused(&account.id).await {
                log::debug!("Skipping paused account: {}", account.name);
                continue;
            }

            let result = Self::fetch_account_usage(&account).await;
            Self::process_account_result(app, state, &account, result, &mut max_utilization_overall).await;
        }

        // Adaptive refresh based on max utilization across all accounts
        Self::maybe_adjust_interval_from_utilization(app, state, max_utilization_overall);
    }

    /// Fetch usage for a single account
    async fn fetch_account_usage(account: &Account) -> Result<UsageData, AppError> {
        let claude = ClaudeProvider::new()?;

        if !claude.validate_credentials(&account.credentials) {
            return Err(ProviderError::InvalidCredentials(
                format!("Missing org_id or session_key for account {}", account.name),
            )
            .into());
        }

        let mut usage = claude.fetch_usage(&account.credentials).await?;

        // Set account info on the usage data
        usage.account_id = account.id.clone();
        usage.account_name = account.name.clone();

        Ok(usage)
    }

    /// Process the result of fetching usage for an account
    async fn process_account_result(
        app: &AppHandle,
        state: &SchedulerState,
        account: &Account,
        result: Result<UsageData, AppError>,
        max_utilization: &mut f64,
    ) {
        let event = match result {
            Ok(data) => {
                // Session is valid - reset error count and unpause if needed
                let error_count = state.get_account_error_count(&account.id).await;
                let was_paused = state.is_account_paused(&account.id).await;

                if error_count > 0 || was_paused {
                    log::info!("Session restored for account {}, resuming", account.name);
                    state.reset_account_error_count(&account.id).await;
                    state.set_account_paused(&account.id, false).await;

                    // Emit session status to frontend
                    let _ = app.emit(
                        "session-status",
                        SessionStatusEvent {
                            account_id: account.id.clone(),
                            valid: true,
                            error_count: 0,
                            paused: false,
                        },
                    );
                }

                // Track max utilization for adaptive refresh
                for limit in &data.limits {
                    if limit.utilization > *max_utilization {
                        *max_utilization = limit.utilization;
                    }
                }

                // Process notifications
                let previous_data = state.get_previous_usage(&account.id).await;

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
                        &account.id,
                        &account.name,
                        limit,
                    );
                }

                // Save to history
                if let Err(e) = HistoryService::add_entry(app, &data) {
                    log::warn!("Failed to save usage to history: {}", e);
                }

                // Store current usage as previous for next comparison
                state.set_previous_usage(&account.id, data.clone()).await;

                UsageUpdateEvent {
                    provider: "claude".to_string(),
                    account_id: account.id.clone(),
                    data: Some(data),
                    error: None,
                }
            }
            Err(e) => {
                log::error!("Failed to fetch usage for account {}: {}", account.name, e);

                // Check if this is a session expiry error
                let error_str = e.to_string();
                let is_session_error = error_str.contains("expired")
                    || error_str.contains("401")
                    || error_str.contains("SessionExpired");

                if is_session_error {
                    NotificationService::send_session_expiry_warning(app);

                    // Track consecutive session errors per account
                    let error_count = state.increment_account_error_count(&account.id).await;
                    log::warn!(
                        "Session error {}/{} for account {} - {}",
                        error_count,
                        MAX_SESSION_ERRORS,
                        account.name,
                        error_str
                    );

                    // Pause this account after too many consecutive errors
                    if error_count >= MAX_SESSION_ERRORS {
                        log::warn!(
                            "Too many session errors ({}) for account {}, pausing",
                            error_count,
                            account.name
                        );
                        state.set_account_paused(&account.id, true).await;

                        // Emit session status to frontend
                        let _ = app.emit(
                            "session-status",
                            SessionStatusEvent {
                                account_id: account.id.clone(),
                                valid: false,
                                error_count,
                                paused: true,
                            },
                        );
                    } else {
                        // Emit session status (not paused yet)
                        let _ = app.emit(
                            "session-status",
                            SessionStatusEvent {
                                account_id: account.id.clone(),
                                valid: false,
                                error_count,
                                paused: false,
                            },
                        );
                    }
                }

                UsageUpdateEvent {
                    provider: "claude".to_string(),
                    account_id: account.id.clone(),
                    data: None,
                    error: Some(error_str),
                }
            }
        };

        // Emit to frontend
        let _ = app.emit("usage-update", event);
    }

    /// Adjust interval based on max utilization (adaptive refresh)
    fn maybe_adjust_interval_from_utilization(app: &AppHandle, state: &SchedulerState, max_utilization: f64) {
        // Get settings to check if adaptive mode is enabled
        let settings = match SettingsService::get(app) {
            Ok(s) => s,
            Err(_) => return,
        };

        if settings.refresh_mode != "adaptive" {
            return;
        }

        // Determine new interval based on usage level (utilization is 0-100)
        let new_interval = if max_utilization >= 90.0 {
            60  // Very high usage: check every minute
        } else if max_utilization >= 75.0 {
            180 // High usage: check every 3 minutes
        } else if max_utilization >= 50.0 {
            300 // Medium usage: check every 5 minutes
        } else {
            600 // Low usage: check every 10 minutes
        };

        let current_interval = state.get_interval();
        if new_interval != current_interval {
            log::info!(
                "Adaptive refresh: adjusting interval from {}s to {}s (max usage: {:.0}%)",
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

    // Legacy function kept for backward compatibility with force_refresh
    async fn fetch_and_emit(app: &AppHandle, state: &SchedulerState) {
        Self::fetch_all_accounts(app, state).await;
    }
}
