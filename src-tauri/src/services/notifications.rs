use crate::models::{AppSettings, NotificationSettings, UsageData, UsageLimit};
use crate::services::SettingsService;
use chrono::{Duration, Local, NaiveTime, Utc};
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

/// Tracks which notifications have been sent to avoid duplicates
pub struct NotificationState {
    /// Set of (account_id, limit_id, threshold) tuples that have been notified
    sent_thresholds: Mutex<HashSet<(String, String, u32)>>,
    /// Set of (account_id, limit_id) pairs that have been notified for upcoming reset
    sent_reset_warnings: Mutex<HashSet<(String, String)>>,
}

impl Default for NotificationState {
    fn default() -> Self {
        Self {
            sent_thresholds: Mutex::new(HashSet::new()),
            sent_reset_warnings: Mutex::new(HashSet::new()),
        }
    }
}

impl NotificationState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if a threshold notification was already sent for this account
    pub fn was_threshold_notified(&self, account_id: &str, limit_id: &str, threshold: u32) -> bool {
        let sent = self.sent_thresholds.lock().unwrap();
        sent.contains(&(account_id.to_string(), limit_id.to_string(), threshold))
    }

    /// Mark a threshold notification as sent for this account
    pub fn mark_threshold_notified(&self, account_id: &str, limit_id: &str, threshold: u32) {
        let mut sent = self.sent_thresholds.lock().unwrap();
        sent.insert((account_id.to_string(), limit_id.to_string(), threshold));
    }

    /// Clear threshold notifications for a limit (called when usage drops or resets)
    pub fn clear_threshold(&self, account_id: &str, limit_id: &str, threshold: u32) {
        let mut sent = self.sent_thresholds.lock().unwrap();
        sent.remove(&(account_id.to_string(), limit_id.to_string(), threshold));
    }

    /// Clear all thresholds above a certain value for a limit on this account
    pub fn clear_thresholds_above(&self, account_id: &str, limit_id: &str, current_percent: u32) {
        let mut sent = self.sent_thresholds.lock().unwrap();
        sent.retain(|(acc, id, thresh)| {
            !(acc == account_id && id == limit_id && *thresh > current_percent)
        });
    }

    /// Check if reset warning was sent for this account
    pub fn was_reset_warning_sent(&self, account_id: &str, limit_id: &str) -> bool {
        let sent = self.sent_reset_warnings.lock().unwrap();
        sent.contains(&(account_id.to_string(), limit_id.to_string()))
    }

    /// Mark reset warning as sent for this account
    pub fn mark_reset_warning_sent(&self, account_id: &str, limit_id: &str) {
        let mut sent = self.sent_reset_warnings.lock().unwrap();
        sent.insert((account_id.to_string(), limit_id.to_string()));
    }

    /// Clear reset warning (called after reset occurs)
    pub fn clear_reset_warning(&self, account_id: &str, limit_id: &str) {
        let mut sent = self.sent_reset_warnings.lock().unwrap();
        sent.remove(&(account_id.to_string(), limit_id.to_string()));
    }
}

pub struct NotificationService;

impl NotificationService {
    /// Process usage data and send appropriate notifications
    pub fn process_usage(
        app: &AppHandle,
        state: &NotificationState,
        usage: &UsageData,
        previous_usage: Option<&UsageData>,
    ) {
        // Get notification settings
        let settings = match SettingsService::get(app) {
            Ok(s) => s,
            Err(_) => return,
        };

        if !settings.notifications.enabled {
            return;
        }

        let account_id = &usage.account_id;
        let account_name = &usage.account_name;

        for limit in &usage.limits {
            // utilization is already a percentage (0-100) from the API
            let current_percent = limit.utilization as u32;

            // Clear thresholds that are now above current usage (usage dropped)
            state.clear_thresholds_above(account_id, &limit.id, current_percent);

            // Check threshold notifications
            Self::check_threshold_notifications(app, state, account_id, account_name, limit, &settings);

            // Check for reset notifications
            if settings.notifications.notify_on_reset {
                Self::check_reset_notification(app, state, account_id, account_name, limit, previous_usage);
            }
        }
    }

    /// Check and send threshold notifications
    fn check_threshold_notifications(
        app: &AppHandle,
        state: &NotificationState,
        account_id: &str,
        account_name: &str,
        limit: &UsageLimit,
        settings: &AppSettings,
    ) {
        // utilization is already a percentage (0-100) from the API
        let current_percent = limit.utilization as u32;

        log::info!(
            "Checking notifications for {} ({}): utilization={}, current_percent={}%",
            limit.id,
            account_name,
            limit.utilization,
            current_percent
        );

        for &threshold in &settings.notifications.thresholds {
            if current_percent >= threshold && !state.was_threshold_notified(account_id, &limit.id, threshold) {
                // Include account name in notification if it's not "Default"
                let title = format!("{}% Usage Alert", threshold);
                let body = if account_name != "Default" && !account_name.is_empty() {
                    format!(
                        "[{}] {} is at {}% usage",
                        account_name,
                        limit.label,
                        current_percent.min(100)
                    )
                } else {
                    format!(
                        "{} is at {}% usage",
                        limit.label,
                        current_percent.min(100)
                    )
                };

                if Self::send_notification(app, &title, &body) {
                    state.mark_threshold_notified(account_id, &limit.id, threshold);
                    log::info!(
                        "Sent {}% threshold notification for {} ({})",
                        threshold,
                        limit.id,
                        account_name
                    );
                }
            }
        }
    }

    /// Check and send reset notification
    fn check_reset_notification(
        app: &AppHandle,
        state: &NotificationState,
        account_id: &str,
        account_name: &str,
        limit: &UsageLimit,
        previous_usage: Option<&UsageData>,
    ) {
        // Check if this limit just reset (previous was high, now low)
        if let Some(prev) = previous_usage {
            if let Some(prev_limit) = prev.limits.iter().find(|l| l.id == limit.id) {
                // utilization is already a percentage (0-100) from the API
                let prev_percent = prev_limit.utilization as u32;
                let curr_percent = limit.utilization as u32;

                // If usage dropped significantly (more than 50%) and was previously high
                if prev_percent >= 50 && curr_percent < prev_percent.saturating_sub(40) {
                    let title = "Usage Reset";
                    let body = if account_name != "Default" && !account_name.is_empty() {
                        format!(
                            "[{}] {} has reset! Now at {}%",
                            account_name,
                            limit.label,
                            curr_percent
                        )
                    } else {
                        format!(
                            "{} has reset! Now at {}%",
                            limit.label,
                            curr_percent
                        )
                    };

                    Self::send_notification(app, title, &body);
                    state.clear_reset_warning(account_id, &limit.id);

                    // Clear all threshold notifications for this limit
                    for thresh in [50, 75, 90, 100] {
                        state.clear_threshold(account_id, &limit.id, thresh);
                    }

                    // Emit event for frontend confetti animation
                    let _ = app.emit("usage-reset", &limit.id);

                    log::info!("Sent reset notification for {} ({})", limit.id, account_name);
                }
            }
        }
    }

    /// Send notification for upcoming reset (within 1 hour)
    pub fn check_upcoming_reset(
        app: &AppHandle,
        state: &NotificationState,
        account_id: &str,
        account_name: &str,
        limit: &UsageLimit,
    ) {
        let settings = match SettingsService::get(app) {
            Ok(s) => s,
            Err(_) => return,
        };

        if !settings.notifications.enabled || !settings.notifications.notify_on_reset {
            return;
        }

        // Check if reset is within 1 hour and usage is high
        let now = Utc::now();
        let time_until_reset = limit.resets_at.signed_duration_since(now);
        // utilization is already a percentage (0-100) from the API
        let current_percent = limit.utilization as u32;

        if time_until_reset > Duration::zero()
            && time_until_reset <= Duration::hours(1)
            && current_percent >= 75
            && !state.was_reset_warning_sent(account_id, &limit.id)
        {
            let minutes = time_until_reset.num_minutes();
            let title = "Limit Reset Soon";
            let body = if account_name != "Default" && !account_name.is_empty() {
                format!(
                    "[{}] {} will reset in {} minutes (currently at {}%)",
                    account_name, limit.label, minutes, current_percent
                )
            } else {
                format!(
                    "{} will reset in {} minutes (currently at {}%)",
                    limit.label, minutes, current_percent
                )
            };

            if Self::send_notification(app, title, &body) {
                state.mark_reset_warning_sent(account_id, &limit.id);
                log::info!("Sent upcoming reset notification for {} ({})", limit.id, account_name);
            }
        }
    }

    /// Send a session expiry warning
    pub fn send_session_expiry_warning(app: &AppHandle) {
        let settings = match SettingsService::get(app) {
            Ok(s) => s,
            Err(_) => return,
        };

        if !settings.notifications.enabled || !settings.notifications.notify_on_expiry {
            return;
        }

        Self::send_notification(
            app,
            "Session Expiring",
            "Your Claude session may be expiring soon. Please refresh your credentials.",
        );
    }

    /// Check if currently in Do Not Disturb time window
    fn is_dnd_active(settings: &NotificationSettings) -> bool {
        if !settings.dnd_enabled {
            return false;
        }

        let (start_str, end_str) = match (&settings.dnd_start_time, &settings.dnd_end_time) {
            (Some(s), Some(e)) => (s.as_str(), e.as_str()),
            _ => return false,
        };

        let start = match NaiveTime::parse_from_str(start_str, "%H:%M") {
            Ok(t) => t,
            Err(_) => return false,
        };

        let end = match NaiveTime::parse_from_str(end_str, "%H:%M") {
            Ok(t) => t,
            Err(_) => return false,
        };

        let now = Local::now().time();

        // Handle overnight DND (e.g., 22:00 to 08:00)
        if start > end {
            // DND spans midnight: active if now >= start OR now < end
            now >= start || now < end
        } else {
            // DND within same day: active if now >= start AND now < end
            now >= start && now < end
        }
    }

    /// Send a notification using the Tauri notification plugin
    fn send_notification(app: &AppHandle, title: &str, body: &str) -> bool {
        // Check DND before sending
        if let Ok(settings) = SettingsService::get(app) {
            if Self::is_dnd_active(&settings.notifications) {
                log::debug!(
                    "Notification suppressed (DND active): {} - {}",
                    title,
                    body
                );
                return false;
            }
        }

        match app
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show()
        {
            Ok(_) => {
                log::debug!("Notification sent: {} - {}", title, body);
                true
            }
            Err(e) => {
                log::error!("Failed to send notification: {}", e);
                false
            }
        }
    }
}
