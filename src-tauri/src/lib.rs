use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;

mod commands;
mod error;
mod models;
mod providers;
mod services;

use commands::{
    clear_history, cleanup_history, delete_credentials, export_history_csv, export_history_json,
    fetch_usage, force_refresh, get_credentials, get_history_metadata, get_retention_policy,
    get_scheduler_status, get_settings, get_usage_stats, has_credentials, query_history,
    save_credentials, save_settings, set_refresh_interval, set_retention_policy, start_scheduler,
    stop_scheduler, validate_credentials,
};
use services::{HistoryService, SchedulerService, SchedulerState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(Arc::new(SchedulerState::new()))
        .invoke_handler(tauri::generate_handler![
            // Credential commands
            get_credentials,
            save_credentials,
            delete_credentials,
            has_credentials,
            // Settings commands
            get_settings,
            save_settings,
            // Usage commands
            fetch_usage,
            validate_credentials,
            // Scheduler commands
            get_scheduler_status,
            start_scheduler,
            stop_scheduler,
            set_refresh_interval,
            force_refresh,
            // History commands
            query_history,
            get_history_metadata,
            get_retention_policy,
            set_retention_policy,
            cleanup_history,
            get_usage_stats,
            export_history_json,
            export_history_csv,
            clear_history,
        ])
        .setup(|app| {
            // Set up logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Set up system tray
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let refresh = MenuItem::with_id(app, "refresh", "Refresh", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &refresh, &quit])?;

            // Use app's default window icon for tray (template mode on macOS)
            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .menu(&menu)
                .tooltip("AI Pulse")
                .icon_as_template(true)
                .show_menu_on_left_click(false);

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "refresh" => {
                        // Emit refresh event to frontend
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("tray-refresh", ());
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Run history cleanup on startup (if enabled)
            if let Ok(policy) = HistoryService::get_retention_policy(app.handle()) {
                if policy.auto_cleanup {
                    match HistoryService::cleanup(app.handle()) {
                        Ok(removed) if removed > 0 => {
                            log::info!("Startup cleanup: removed {} old history entries", removed);
                        }
                        Err(e) => {
                            log::warn!("Failed to run startup history cleanup: {}", e);
                        }
                        _ => {}
                    }
                }
            }

            // Start the background scheduler
            let scheduler_state = app.state::<Arc<SchedulerState>>();
            SchedulerService::start(app.handle().clone(), scheduler_state.inner().clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
