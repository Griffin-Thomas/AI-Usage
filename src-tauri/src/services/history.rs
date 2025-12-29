use crate::error::AppError;
use crate::models::{
    HistoryMetadata, HistoryQuery, RetentionPolicy, UsageData, UsageHistoryEntry,
    UsageLimitSnapshot, UsageStats,
};
use chrono::{DateTime, Duration, Utc};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "history.json";
const HISTORY_KEY: &str = "entries";
const METADATA_KEY: &str = "metadata";
const RETENTION_KEY: &str = "retention";

pub struct HistoryService;

impl HistoryService {
    /// Add a new usage snapshot to history
    pub fn add_entry(app: &AppHandle, usage_data: &UsageData) -> Result<(), AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        // Create history entry from usage data
        let entry = UsageHistoryEntry {
            id: format!(
                "{}-{}-{}",
                usage_data.timestamp.timestamp(),
                usage_data.provider,
                usage_data.account_id
            ),
            provider: usage_data.provider.clone(),
            account_id: usage_data.account_id.clone(),
            account_name: usage_data.account_name.clone(),
            timestamp: usage_data.timestamp,
            limits: usage_data
                .limits
                .iter()
                .map(|l| UsageLimitSnapshot {
                    id: l.id.clone(),
                    utilization: l.utilization,
                    resets_at: l.resets_at,
                })
                .collect(),
        };

        // Get existing entries
        let mut entries = Self::get_all_entries(app)?;

        // Avoid duplicate entries (same timestamp and provider)
        if entries.iter().any(|e| e.id == entry.id) {
            return Ok(());
        }

        entries.push(entry);

        // Save entries
        let value = serde_json::to_value(&entries)?;
        store.set(HISTORY_KEY.to_string(), value);
        store.save().map_err(|e| AppError::Store(e.to_string()))?;

        // Update metadata
        Self::update_metadata(app)?;

        log::debug!(
            "Added history entry for provider: {} (total: {})",
            usage_data.provider,
            entries.len()
        );

        Ok(())
    }

    /// Get all history entries
    pub fn get_all_entries(app: &AppHandle) -> Result<Vec<UsageHistoryEntry>, AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        match store.get(HISTORY_KEY) {
            Some(v) => {
                let entries: Vec<UsageHistoryEntry> = serde_json::from_value(v.clone())?;
                Ok(entries)
            }
            None => Ok(Vec::new()),
        }
    }

    /// Query history with filters
    pub fn query(app: &AppHandle, query: &HistoryQuery) -> Result<Vec<UsageHistoryEntry>, AppError> {
        let mut entries = Self::get_all_entries(app)?;

        // Filter by provider
        if let Some(ref provider) = query.provider {
            entries.retain(|e| &e.provider == provider);
        }

        // Filter by account
        if let Some(ref account_id) = query.account_id {
            entries.retain(|e| &e.account_id == account_id);
        }

        // Filter by date range
        if let Some(start) = query.start_date {
            entries.retain(|e| e.timestamp >= start);
        }
        if let Some(end) = query.end_date {
            entries.retain(|e| e.timestamp <= end);
        }

        // Sort by timestamp descending (newest first)
        entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        // Apply offset
        if let Some(offset) = query.offset {
            if offset < entries.len() {
                entries = entries.into_iter().skip(offset).collect();
            } else {
                entries.clear();
            }
        }

        // Apply limit
        let limit = query.limit.unwrap_or(1000);
        entries.truncate(limit);

        Ok(entries)
    }

    /// Get history metadata
    pub fn get_metadata(app: &AppHandle) -> Result<HistoryMetadata, AppError> {
        let entries = Self::get_all_entries(app)?;
        let policy = Self::get_retention_policy(app)?;

        let oldest = entries.iter().map(|e| e.timestamp).min();
        let newest = entries.iter().map(|e| e.timestamp).max();

        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        let last_cleanup = match store.get(METADATA_KEY) {
            Some(v) => {
                let meta: HistoryMetadata = serde_json::from_value(v.clone()).unwrap_or_else(|_| {
                    HistoryMetadata {
                        entry_count: 0,
                        oldest_entry: None,
                        newest_entry: None,
                        last_cleanup: None,
                        retention_days: policy.retention_days,
                    }
                });
                meta.last_cleanup
            }
            None => None,
        };

        Ok(HistoryMetadata {
            entry_count: entries.len(),
            oldest_entry: oldest,
            newest_entry: newest,
            last_cleanup,
            retention_days: policy.retention_days,
        })
    }

    /// Update metadata after changes
    fn update_metadata(app: &AppHandle) -> Result<(), AppError> {
        let metadata = Self::get_metadata(app)?;

        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        let value = serde_json::to_value(&metadata)?;
        store.set(METADATA_KEY.to_string(), value);
        store.save().map_err(|e| AppError::Store(e.to_string()))?;

        Ok(())
    }

    /// Get retention policy
    pub fn get_retention_policy(app: &AppHandle) -> Result<RetentionPolicy, AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        match store.get(RETENTION_KEY) {
            Some(v) => {
                let policy: RetentionPolicy = serde_json::from_value(v.clone())?;
                Ok(policy)
            }
            None => Ok(RetentionPolicy::default()),
        }
    }

    /// Set retention policy
    pub fn set_retention_policy(app: &AppHandle, policy: &RetentionPolicy) -> Result<(), AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        let value = serde_json::to_value(policy)?;
        store.set(RETENTION_KEY.to_string(), value);
        store.save().map_err(|e| AppError::Store(e.to_string()))?;

        log::info!(
            "Updated retention policy: {} days, auto_cleanup: {}",
            policy.retention_days,
            policy.auto_cleanup
        );

        Ok(())
    }

    /// Clean up old entries based on retention policy
    pub fn cleanup(app: &AppHandle) -> Result<usize, AppError> {
        let policy = Self::get_retention_policy(app)?;

        // 0 means unlimited retention
        if policy.retention_days == 0 {
            return Ok(0);
        }

        let cutoff = Utc::now() - Duration::days(policy.retention_days as i64);
        let mut entries = Self::get_all_entries(app)?;
        let original_count = entries.len();

        entries.retain(|e| e.timestamp >= cutoff);
        let removed_count = original_count - entries.len();

        if removed_count > 0 {
            let store = app
                .store(STORE_FILE)
                .map_err(|e| AppError::Store(e.to_string()))?;

            let value = serde_json::to_value(&entries)?;
            store.set(HISTORY_KEY.to_string(), value);

            // Update last_cleanup timestamp
            let mut metadata = Self::get_metadata(app)?;
            metadata.last_cleanup = Some(Utc::now());
            let meta_value = serde_json::to_value(&metadata)?;
            store.set(METADATA_KEY.to_string(), meta_value);

            store.save().map_err(|e| AppError::Store(e.to_string()))?;

            log::info!(
                "Cleaned up {} history entries older than {} days",
                removed_count,
                policy.retention_days
            );
        }

        Ok(removed_count)
    }

    /// Calculate usage statistics for a time period
    pub fn get_stats(
        app: &AppHandle,
        provider: &str,
        limit_id: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Option<UsageStats>, AppError> {
        let query = HistoryQuery {
            provider: Some(provider.to_string()),
            account_id: None,
            start_date: Some(start),
            end_date: Some(end),
            limit: None,
            offset: None,
        };

        let entries = Self::query(app, &query)?;

        // Find all utilization values for the specific limit
        let utilizations: Vec<f64> = entries
            .iter()
            .flat_map(|e| e.limits.iter())
            .filter(|l| l.id == limit_id)
            .map(|l| l.utilization)
            .collect();

        if utilizations.is_empty() {
            return Ok(None);
        }

        let sum: f64 = utilizations.iter().sum();
        let count = utilizations.len();
        let avg = sum / count as f64;
        let max = utilizations.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let min = utilizations.iter().cloned().fold(f64::INFINITY, f64::min);

        Ok(Some(UsageStats {
            provider: provider.to_string(),
            limit_id: limit_id.to_string(),
            period_start: start,
            period_end: end,
            avg_utilization: avg,
            max_utilization: max,
            min_utilization: min,
            sample_count: count,
        }))
    }

    /// Export history to JSON string
    pub fn export_json(app: &AppHandle, query: Option<&HistoryQuery>) -> Result<String, AppError> {
        let entries = match query {
            Some(q) => Self::query(app, q)?,
            None => Self::get_all_entries(app)?,
        };

        let json = serde_json::to_string_pretty(&entries)?;
        Ok(json)
    }

    /// Export history to CSV string
    pub fn export_csv(app: &AppHandle, query: Option<&HistoryQuery>) -> Result<String, AppError> {
        let entries = match query {
            Some(q) => Self::query(app, q)?,
            None => Self::get_all_entries(app)?,
        };

        let mut csv = String::from("id,provider,timestamp,limit_id,utilization,resets_at\n");

        for entry in entries {
            for limit in &entry.limits {
                csv.push_str(&format!(
                    "{},{},{},{},{:.2},{}\n",
                    entry.id,
                    entry.provider,
                    entry.timestamp.to_rfc3339(),
                    limit.id,
                    limit.utilization,
                    limit.resets_at.to_rfc3339()
                ));
            }
        }

        Ok(csv)
    }

    /// Clear all history data
    pub fn clear_all(app: &AppHandle) -> Result<(), AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        store.set(HISTORY_KEY.to_string(), serde_json::json!([]));
        store.save().map_err(|e| AppError::Store(e.to_string()))?;

        Self::update_metadata(app)?;

        log::info!("Cleared all history data");
        Ok(())
    }
}
