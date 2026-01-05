//! History command - show usage history

use crate::client::{ApiClient, HistoryResponse};
use crate::output::print_header;
use chrono::{DateTime, Duration, Utc};
use colored::Colorize;

/// Run the history command
pub fn run(
    client: &ApiClient,
    days: u32,
    limit: Option<usize>,
    json: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    // Calculate start date
    let start_date = Utc::now() - Duration::days(days as i64);
    let start_param = start_date.to_rfc3339();

    // Build query parameters
    let mut path = format!("/history?startDate={}", urlencoding_encode(&start_param));
    if let Some(l) = limit {
        path.push_str(&format!("&limit={}", l));
    }

    let response: HistoryResponse = client.get(&path)?;

    if json {
        println!("{}", serde_json::to_string_pretty(&response)?);
        return Ok(());
    }

    if response.entries.is_empty() {
        println!("{}", "No history entries found".yellow());
        println!("Usage data will be recorded as you use AI Pulse.");
        return Ok(());
    }

    print_header(&format!(
        "Usage History (last {} day{})",
        days,
        if days == 1 { "" } else { "s" }
    ));
    println!();

    // Group entries by account
    let mut current_account: Option<String> = None;

    for entry in &response.entries {
        // Print account header if changed
        if current_account.as_ref() != Some(&entry.account_id) {
            if current_account.is_some() {
                println!();
            }
            println!("{} ({})", entry.account_name.bold(), entry.provider.dimmed());
            current_account = Some(entry.account_id.clone());
        }

        // Parse and format timestamp
        let timestamp = DateTime::parse_from_rfc3339(&entry.timestamp)
            .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
            .unwrap_or_else(|_| entry.timestamp.clone());

        // Format limits
        let limits_str: Vec<String> = entry
            .limits
            .iter()
            .map(|l| format!("{}: {:.0}%", l.id, l.utilization))
            .collect();

        println!(
            "  {} │ {}",
            timestamp.dimmed(),
            limits_str.join(", ")
        );
    }

    println!();
    println!(
        "{} {} entries",
        "Total:".dimmed(),
        response.total
    );
    println!();

    Ok(())
}

/// Simple URL encoding for query parameters
fn urlencoding_encode(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            ':' => "%3A".to_string(),
            '+' => "%2B".to_string(),
            ' ' => "%20".to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}
