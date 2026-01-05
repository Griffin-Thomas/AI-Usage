//! Status command - show current usage for all accounts

use crate::client::{ApiClient, StatusResponse};
use crate::output::{format_percentage, format_time_until, print_header, progress_bar};
use colored::Colorize;

/// Run the status command
pub fn run(client: &ApiClient, json: bool, account_filter: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
    let response: StatusResponse = client.get("/status")?;

    if json {
        // Filter accounts if specified
        let filtered = if let Some(filter) = account_filter {
            let filter_lower = filter.to_lowercase();
            StatusResponse {
                timestamp: response.timestamp,
                accounts: response
                    .accounts
                    .into_iter()
                    .filter(|a| {
                        a.name.to_lowercase().contains(&filter_lower)
                            || a.id.to_lowercase().contains(&filter_lower)
                    })
                    .collect(),
            }
        } else {
            response
        };

        println!("{}", serde_json::to_string_pretty(&filtered)?);
        return Ok(());
    }

    // Check if we have any accounts
    if response.accounts.is_empty() {
        println!("{}", "No accounts configured".yellow());
        println!("Add an account in AI Pulse Settings to start monitoring usage.");
        return Ok(());
    }

    // Filter accounts if specified
    let accounts: Vec<_> = if let Some(filter) = account_filter {
        let filter_lower = filter.to_lowercase();
        response
            .accounts
            .iter()
            .filter(|a| {
                a.name.to_lowercase().contains(&filter_lower)
                    || a.id.to_lowercase().contains(&filter_lower)
            })
            .collect()
    } else {
        response.accounts.iter().collect()
    };

    if accounts.is_empty() {
        println!("{} No account matching '{}'", "Not found:".yellow(), account_filter.unwrap_or(""));
        return Ok(());
    }

    print_header("AI Pulse Usage Status");

    for account in accounts {
        println!();

        // Account header
        let session_status = if account.session_valid {
            "●".green()
        } else {
            "●".red()
        };

        println!(
            "{} {} ({})",
            session_status,
            account.name.bold(),
            account.provider.dimmed()
        );

        if !account.session_valid {
            println!("  {} Session expired - update credentials in AI Pulse", "⚠".yellow());
        }

        // Usage limits
        for limit in &account.limits {
            let bar = progress_bar(limit.utilization, 10);
            let pct = format_percentage(limit.utilization);
            let reset = format_time_until(&limit.resets_at);

            println!(
                "  {:<16} {}  {}  Resets in {}",
                limit.label,
                bar,
                pct,
                reset.dimmed()
            );
        }

        if account.limits.is_empty() {
            println!("  {}", "No usage data available".dimmed());
        }
    }

    println!();
    Ok(())
}
