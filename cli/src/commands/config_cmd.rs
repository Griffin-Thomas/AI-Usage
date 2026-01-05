//! Config command - manage CLI configuration

use crate::config::Config;
use colored::Colorize;

/// Show current configuration
pub fn show(config: &Config) -> Result<(), Box<dyn std::error::Error>> {
    println!("{}", "CLI Configuration".bold());
    println!();

    println!("  {} {}", "port:".dimmed(), config.port);
    println!(
        "  {} {}",
        "token:".dimmed(),
        config.token.as_ref().map(|t| {
            if t.len() > 8 {
                format!("{}...{}", &t[..4], &t[t.len()-4..])
            } else {
                "*".repeat(t.len())
            }
        }).unwrap_or_else(|| "(not set)".to_string())
    );

    println!();
    if let Some(path) = Config::config_path() {
        println!("{} {}", "Config file:".dimmed(), path.display());
    }

    Ok(())
}

/// Set a configuration value
pub fn set(key: &str, value: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut config = Config::load().unwrap_or_default();

    config.set(key, value)?;
    config.save()?;

    println!("{} {} = {}", "✓".green(), key, value);
    Ok(())
}
