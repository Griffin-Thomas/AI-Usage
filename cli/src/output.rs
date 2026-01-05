//! Output formatting utilities

use chrono::{DateTime, Utc};
use colored::Colorize;

/// Format a duration in a human-readable way
pub fn format_duration(seconds: i64) -> String {
    if seconds < 0 {
        return "expired".to_string();
    }

    let days = seconds / 86400;
    let hours = (seconds % 86400) / 3600;
    let minutes = (seconds % 3600) / 60;

    if days > 0 {
        format!("{}d {}h", days, hours)
    } else if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else if minutes > 0 {
        format!("{}m", minutes)
    } else {
        format!("{}s", seconds)
    }
}

/// Format a timestamp as a relative time (e.g., "2h 15m")
pub fn format_time_until(iso_timestamp: &str) -> String {
    let parsed = DateTime::parse_from_rfc3339(iso_timestamp)
        .map(|dt| dt.with_timezone(&Utc))
        .ok();

    match parsed {
        Some(target) => {
            let now = Utc::now();
            let duration = target.signed_duration_since(now);
            let seconds = duration.num_seconds();
            format_duration(seconds)
        }
        None => "unknown".to_string(),
    }
}

/// Create a progress bar string
pub fn progress_bar(percentage: f64, width: usize) -> String {
    let filled = ((percentage / 100.0) * width as f64).round() as usize;
    let empty = width.saturating_sub(filled);
    format!("{}{}", "█".repeat(filled), "░".repeat(empty))
}

/// Get color based on usage percentage
pub fn usage_color(percentage: f64) -> colored::Color {
    if percentage >= 90.0 {
        colored::Color::Red
    } else if percentage >= 75.0 {
        colored::Color::Yellow
    } else if percentage >= 50.0 {
        colored::Color::BrightYellow
    } else {
        colored::Color::Green
    }
}

/// Format percentage with color
pub fn format_percentage(value: f64) -> colored::ColoredString {
    let text = format!("{:>3.0}%", value);
    text.color(usage_color(value))
}

/// Print a section header
pub fn print_header(title: &str) {
    println!();
    println!("{}", title.bold());
    println!("{}", "━".repeat(title.len()).dimmed());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(30), "30s");
        assert_eq!(format_duration(90), "1m");
        assert_eq!(format_duration(3600), "1h 0m");
        assert_eq!(format_duration(3660), "1h 1m");
        assert_eq!(format_duration(86400), "1d 0h");
        assert_eq!(format_duration(90000), "1d 1h");
    }

    #[test]
    fn test_progress_bar() {
        assert_eq!(progress_bar(0.0, 10), "░░░░░░░░░░");
        assert_eq!(progress_bar(50.0, 10), "█████░░░░░");
        assert_eq!(progress_bar(100.0, 10), "██████████");
    }

    #[test]
    fn test_usage_color() {
        assert_eq!(usage_color(0.0), colored::Color::Green);
        assert_eq!(usage_color(50.0), colored::Color::BrightYellow);
        assert_eq!(usage_color(75.0), colored::Color::Yellow);
        assert_eq!(usage_color(90.0), colored::Color::Red);
    }
}
