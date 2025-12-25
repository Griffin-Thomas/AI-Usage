use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_notification::NotificationExt;

mod commands;
mod error;
mod models;
mod providers;
mod services;

use commands::{
    clear_history, cleanup_history, delete_credentials, export_history_csv, export_history_json,
    fetch_usage, force_refresh, get_credentials, get_history_metadata, get_retention_policy,
    get_scheduler_status, get_settings, get_usage_stats, has_credentials, list_providers,
    query_history, save_credentials, save_settings, set_refresh_interval, set_retention_policy,
    start_scheduler, stop_scheduler, test_connection, validate_credentials,
};
use services::{HistoryService, SchedulerService, SchedulerState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
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
            test_connection,
            list_providers,
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

            // Send welcome notification on first launch (also triggers macOS permission prompt)
            {
                use tauri_plugin_store::StoreExt;
                let store = app.store("settings.json")?;
                let welcome_shown = store.get("welcome_shown").and_then(|v| v.as_bool()).unwrap_or(false);

                if !welcome_shown {
                    let _ = app
                        .notification()
                        .builder()
                        .title("Welcome to AI Pulse!")
                        .body("Thank you for using AI Pulse. Your usage will be monitored in the menu bar.")
                        .show();

                    store.set("welcome_shown", serde_json::json!(true));
                    let _ = store.save();
                }
            }

            // Set up native application menu (macOS menu bar, Windows/Linux window menu)
            #[cfg(target_os = "macos")]
            {
                let app_menu = Submenu::with_items(
                    app,
                    "AI Pulse",
                    true,
                    &[
                        &MenuItem::with_id(app, "menu-about", "About AI Pulse", true, None::<&str>)?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(app, "menu-settings", "Settings...", true, Some("CmdOrCtrl+,"))?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::hide(app, Some("Hide AI Pulse"))?,
                        &PredefinedMenuItem::hide_others(app, Some("Hide Others"))?,
                        &PredefinedMenuItem::show_all(app, Some("Show All"))?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::quit(app, Some("Quit AI Pulse"))?,
                    ],
                )?;

                let edit_menu = Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &PredefinedMenuItem::undo(app, None)?,
                        &PredefinedMenuItem::redo(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::cut(app, None)?,
                        &PredefinedMenuItem::copy(app, None)?,
                        &PredefinedMenuItem::paste(app, None)?,
                        &PredefinedMenuItem::select_all(app, None)?,
                    ],
                )?;

                let view_menu = Submenu::with_items(
                    app,
                    "View",
                    true,
                    &[
                        &MenuItem::with_id(app, "menu-refresh", "Refresh Usage", true, Some("CmdOrCtrl+R"))?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(app, "menu-usage", "Current Usage", true, Some("CmdOrCtrl+1"))?,
                        &MenuItem::with_id(app, "menu-analytics", "Analytics", true, Some("CmdOrCtrl+2"))?,
                    ],
                )?;

                let window_menu = Submenu::with_items(
                    app,
                    "Window",
                    true,
                    &[
                        &PredefinedMenuItem::minimize(app, None)?,
                        &PredefinedMenuItem::maximize(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::close_window(app, None)?,
                    ],
                )?;

                let app_menu_bar = Menu::with_items(app, &[&app_menu, &edit_menu, &view_menu, &window_menu])?;
                app.set_menu(app_menu_bar)?;
            }

            // Set up system tray
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let refresh = MenuItem::with_id(app, "refresh", "Refresh", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &refresh, &settings, &quit])?;

            // Platform-specific tray configuration
            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .menu(&menu);

            // macOS: Use template mode for proper dark/light theme support
            #[cfg(target_os = "macos")]
            {
                tray_builder = tray_builder
                    .tooltip("AI Pulse")
                    .icon_as_template(true)
                    .show_menu_on_left_click(false);
            }

            // Windows: Standard tray behavior with tooltip
            #[cfg(target_os = "windows")]
            {
                tray_builder = tray_builder
                    .tooltip("AI Pulse - Click to show dashboard")
                    .show_menu_on_left_click(false);
            }

            // Linux: Limited tray support (no tooltip, menu always on click)
            // Note: On some Linux DEs, you may need libayatana-appindicator
            #[cfg(target_os = "linux")]
            {
                tray_builder = tray_builder
                    .title("AI Pulse")
                    .show_menu_on_left_click(true); // Linux typically expects menu on left-click
            }

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
                    "settings" => {
                        // Show window and emit settings event to frontend
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("tray-settings", ());
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

            // Handle application menu events (macOS menu bar items)
            #[cfg(target_os = "macos")]
            {
                app.on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "menu-about" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("show-about", ());
                            }
                        }
                        "menu-settings" => {
                            // Toggle settings - emit event to frontend to handle open/close
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("toggle-settings", ());
                            }
                        }
                        "menu-refresh" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("tray-refresh", ());
                            }
                        }
                        "menu-usage" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("menu-usage", ());
                            }
                        }
                        "menu-analytics" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("menu-analytics", ());
                            }
                        }
                        _ => {}
                    }
                });
            }

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
