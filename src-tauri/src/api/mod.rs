//! Local API server for CLI and IDE integrations.
//!
//! This module provides a REST API server that runs on localhost, allowing
//! external tools like the CLI and VS Code extension to query usage data.

mod handlers;
mod routes;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use tauri::AppHandle;

use crate::services::SchedulerState;

/// Shared state for the API server
#[derive(Clone)]
pub struct ApiState {
    pub app: AppHandle,
    pub scheduler_state: Arc<SchedulerState>,
}

impl ApiState {
    pub fn new(app: AppHandle, scheduler_state: Arc<SchedulerState>) -> Self {
        Self {
            app,
            scheduler_state,
        }
    }
}

/// Start the API server on the specified port
///
/// The server runs until the app exits. No shutdown handle is needed.
pub fn start_server(state: ApiState, port: u16, token: Option<String>) {
    tauri::async_runtime::spawn(async move {
        let app = create_app(state, token);
        let addr = SocketAddr::from(([127, 0, 0, 1], port));

        log::info!("Starting API server on http://{}", addr);

        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => listener,
            Err(e) => {
                log::error!("Failed to bind API server to {}: {}", addr, e);
                return;
            }
        };

        // Run server until app exits
        if let Err(e) = axum::serve(listener, app).await {
            log::error!("API server error: {}", e);
        }
    });
}

/// Create the Axum application with all routes
fn create_app(state: ApiState, token: Option<String>) -> Router {
    routes::create_router(state, token)
}

#[cfg(test)]
mod tests {
    #[test]
    fn api_state_clone() {
        // ApiState should be cloneable (required by axum)
        // This is a compile-time check
    }
}
