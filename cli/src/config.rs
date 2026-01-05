//! CLI configuration management

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// CLI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// API server port
    #[serde(default = "default_port")]
    pub port: u16,

    /// Authentication token (optional)
    #[serde(default)]
    pub token: Option<String>,
}

fn default_port() -> u16 {
    31415
}

impl Default for Config {
    fn default() -> Self {
        Self {
            port: default_port(),
            token: None,
        }
    }
}

impl Config {
    /// Get the config file path
    pub fn config_path() -> Option<PathBuf> {
        dirs::config_dir().map(|mut p| {
            p.push("ai-pulse");
            p.push("cli.toml");
            p
        })
    }

    /// Load configuration from file
    pub fn load() -> Result<Self, String> {
        let path = Self::config_path()
            .ok_or_else(|| "Could not determine config directory".to_string())?;

        if !path.exists() {
            return Ok(Self::default());
        }

        let contents = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        toml::from_str(&contents)
            .map_err(|e| format!("Failed to parse config file: {}", e))
    }

    /// Save configuration to file
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path()
            .ok_or_else(|| "Could not determine config directory".to_string())?;

        // Create parent directories if needed
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let contents = toml::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&path, contents)
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        Ok(())
    }

    /// Set a configuration value by key
    pub fn set(&mut self, key: &str, value: &str) -> Result<(), String> {
        match key {
            "port" => {
                let port: u16 = value
                    .parse()
                    .map_err(|_| "Port must be a number between 1024 and 65535")?;
                if port < 1024 {
                    return Err("Port must be at least 1024".to_string());
                }
                self.port = port;
            }
            "token" => {
                if value.is_empty() {
                    self.token = None;
                } else {
                    self.token = Some(value.to_string());
                }
            }
            _ => {
                return Err(format!(
                    "Unknown config key: {}. Valid keys are: port, token",
                    key
                ));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.port, 31415);
        assert!(config.token.is_none());
    }

    #[test]
    fn test_set_port() {
        let mut config = Config::default();
        config.set("port", "8080").unwrap();
        assert_eq!(config.port, 8080);
    }

    #[test]
    fn test_set_token() {
        let mut config = Config::default();
        config.set("token", "my-secret").unwrap();
        assert_eq!(config.token, Some("my-secret".to_string()));
    }

    #[test]
    fn test_set_empty_token() {
        let mut config = Config::default();
        config.token = Some("old-token".to_string());
        config.set("token", "").unwrap();
        assert!(config.token.is_none());
    }

    #[test]
    fn test_set_invalid_key() {
        let mut config = Config::default();
        let result = config.set("invalid", "value");
        assert!(result.is_err());
    }

    #[test]
    fn test_set_invalid_port() {
        let mut config = Config::default();
        let result = config.set("port", "not-a-number");
        assert!(result.is_err());
    }
}
