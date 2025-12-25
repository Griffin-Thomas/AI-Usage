# Changelog

All notable changes to AI Pulse will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Provider registry for multi-provider support (Rust backend)
- Settings now shows all providers with availability status (Available/Blocked)
- `list_providers` command for frontend to query provider metadata
- Comprehensive API integration research for ChatGPT and Gemini in `docs/api-integration.md`

### Documentation
- Documented ChatGPT integration blockers (no usage API available)
- Documented Gemini integration blockers (complex Cloud Monitoring API required)

## [0.11.0] - 2025-12-24

### Added
- Custom About dialog with author info, Buy Me a Coffee link, and Check for Updates button
- macOS: Native application menu bar (AI Pulse, Edit, View, Window menus)
- macOS: Keyboard shortcuts (Cmd+, toggles Settings, Cmd+R for Refresh, Cmd+1 for Usage, Cmd+2 for Analytics)
- Windows: Improved tray tooltip with usage instructions
- Linux: AppIndicator support with left-click menu behaviour
- Platform detection via tauri-plugin-os
- Shell plugin for opening external links

### Changed
- System tray now has platform-specific behaviour:
  - macOS: Template mode for dark/light theme adaptation
  - Windows: Left-click shows dashboard, right-click shows menu
  - Linux: Left-click shows menu (standard Linux behaviour), tooltip disabled (not supported)
- Updated user guide with platform-specific notes

## [0.10.0] - 2025-12-23

### Added
- Pink theme support
- Welcome notification on first launch (triggers macOS notification permission prompt when app is signed)
- Mocked integration tests for Claude API (Rust backend with wiremock)
- Frontend integration tests for Tauri API bindings (32 new tests)

### Fixed
- Fixed macOS notifications not displaying in production builds

## [0.9.0] - 2025-12-19

### Added
- Custom app icon with usage gauge/meter design
- Icon generation script (`npm run generate:icons`)
- Comprehensive user guide with screenshots (`docs/user-guide.md`)
- Contributing guidelines (`CONTRIBUTING.md`)
- Troubleshooting section in user guide

### Changed
- Menu bar tray icon now shows a heartbeat pulse in the centre instead of a dot
- Tray menu now includes Settings option (Show Dashboard, Refresh, Settings, Quit)
- Added explicit tray permissions for tooltip and icon updates

## [0.5.3] - 2025-12-19

### Fixed
- Fixed release workflow failing when changelog contains backticks

## [0.5.2] - 2025-12-19

### Changed
- Switched macOS distribution back to DMG format for standard drag-to-Applications install
- Added installation instructions to README with `xattr -cr` workaround for unsigned apps, since I don't want to spend $99 USD/year for an Apple Developer account

## [0.5.1] - 2025-12-19

### Changed
- Removed DMG format for macOS (use .app.tar.gz instead)
- Dropped Intel macOS (x64) builds - Apple Silicon only

## [0.5.0] - 2025-12-19

### Changed
- Optimized release build to only create necessary bundle types (DMG, NSIS, AppImage) instead of all formats
- Release notes now automatically include changelog entries for that version

## [0.4.0] - 2025-12-19

### Added
- Menu Bar Display setting to choose which usage limit to show in the tray icon
  - Options: "Highest Usage" (default), "5-Hour Limit", "Weekly Limit"
- Setting persists across app restarts

### Fixed
- Fixed crash when Claude API returns null `resets_at` for 0% usage limits
- Fixed tray icon not updating immediately when changing display setting
- Fixed tray icon reverting to "highest" on app reload despite saved setting

## [0.3.0] - 2025-12-18

### Added
- Analytics tab with usage history visualization
- Usage history storage
- Export history to JSON/CSV
- Hourly and daily usage charts
- Auto-updating application with update notifications

### Changed
- Improved system tray with dynamic progress ring icon

## [0.2.0] - 2025-12-17

### Added
- Background scheduler for automatic usage refresh
- Adaptive refresh mode (adjusts interval based on usage level)
- System notifications for usage thresholds (50%, 75%, 90%)
- Session expiry warnings
- Launch at startup option

### Fixed
- Cloudflare bypass for Claude API requests

## [0.1.0] - 2025-12-16

### Added
- Initial release
- Claude usage monitoring via system tray
- Secure credential storage
- Manual refresh capability
- Dark/Light/System theme support
- macOS, Windows, and Linux support
