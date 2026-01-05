//! AI Pulse CLI - Command-line interface for AI Pulse usage monitoring
//!
//! This CLI tool connects to a running AI Pulse desktop app's local API server
//! to display usage data, trigger refreshes, and more.

mod client;
mod config;
mod output;

mod commands {
    pub mod config_cmd;
    pub mod history;
    pub mod refresh;
    pub mod status;
}

use clap::{Parser, Subcommand};
use colored::Colorize;

#[derive(Parser)]
#[command(name = "ai-pulse")]
#[command(author = "Griffin Thomas")]
#[command(version)]
#[command(about = "CLI companion for AI Pulse - monitor AI service usage", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Show current usage status for all accounts
    Status {
        /// Output as JSON
        #[arg(short, long)]
        json: bool,

        /// Show usage for a specific account (by name or ID)
        #[arg(short, long)]
        account: Option<String>,
    },

    /// Show usage history
    History {
        /// Number of days to show (default: 1)
        #[arg(short, long, default_value = "1")]
        days: u32,

        /// Maximum number of entries to show
        #[arg(short, long)]
        limit: Option<usize>,

        /// Output as JSON
        #[arg(long)]
        json: bool,
    },

    /// Trigger an immediate usage refresh
    Refresh,

    /// Manage CLI configuration
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Show current configuration
    Show,

    /// Set a configuration value
    Set {
        /// Configuration key (port, token)
        key: String,

        /// Value to set
        value: String,
    },
}

fn main() {
    let cli = Cli::parse();

    // Load configuration
    let config = match config::Config::load() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("{} Failed to load config: {}", "Error:".red().bold(), e);
            eprintln!("Using default configuration (port 31415, no token)");
            config::Config::default()
        }
    };

    // Create API client
    let client = client::ApiClient::new(config.port, config.token.clone());

    // Execute command
    let result = match cli.command {
        Commands::Status { json, account } => {
            commands::status::run(&client, json, account.as_deref())
        }
        Commands::History { days, limit, json } => {
            commands::history::run(&client, days, limit, json)
        }
        Commands::Refresh => {
            commands::refresh::run(&client)
        }
        Commands::Config { action } => match action {
            ConfigAction::Show => {
                commands::config_cmd::show(&config)
            }
            ConfigAction::Set { key, value } => {
                commands::config_cmd::set(&key, &value)
            }
        },
    };

    if let Err(e) = result {
        eprintln!("{} {}", "Error:".red().bold(), e);
        std::process::exit(1);
    }
}
