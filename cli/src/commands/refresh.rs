//! Refresh command - trigger an immediate usage refresh

use crate::client::{ApiClient, RefreshResponse};
use colored::Colorize;

/// Run the refresh command
pub fn run(client: &ApiClient) -> Result<(), Box<dyn std::error::Error>> {
    let response: RefreshResponse = client.post("/refresh")?;

    if response.success {
        println!("{} {}", "✓".green(), response.message);
    } else {
        println!("{} {}", "⚠".yellow(), response.message);
    }

    Ok(())
}
