# Changelog

All notable changes to AI Pulse will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.18.0] - 2026-01-04

### Added
- Local API server for CLI and IDE integrations
  - REST API endpoints: /health, /status, /accounts, /history, /refresh
  - Runs on configurable port (default: 31415, localhost only)
  - Optional authentication via Bearer token
  - Developer settings section in Settings UI
- CLI companion tool (`ai-pulse`)
  - `ai-pulse status` - Show current usage for all accounts
  - `ai-pulse history` - View usage history
  - `ai-pulse refresh` - Trigger an immediate refresh
  - `ai-pulse config` - Manage CLI configuration
  - Coloured output with progress bars and time formatting
  - JSON output mode for scripting

## [0.17.0] - 2025-12-29

### Added
- Content Security Policy (CSP) to protect against XSS attacks
- AES-256-GCM encryption for credentials stored at rest
  - Automatic migration encrypts existing plaintext credentials on first launch
  - Machine-derived encryption key (no user password required)

## [0.16.0] - 2025-12-29

### Added
- Logo and badges to README (release version, license, platform)
- Clickable logo in About dialog that opens GitHub repository

### Changed
- App icon heartbeat is now sharper and larger
- About dialog now uses the actual app icon image instead of inline SVG

### Fixed
- "Buy Me a Coffee", "View on GitHub", and logo click buttons now work correctly
  - Added missing `opener:allow-default-urls` permission
  - Installed `@tauri-apps/plugin-opener` frontend package
  - Updated imports to use `openUrl` from the correct plugin

## [0.15.0] - 2025-12-29

### Added
- Multi-account support for Claude credentials
  - New AccountManager component in Settings for managing multiple accounts
  - Each account has a name, organization ID, and session key
  - Test connection for individual accounts before saving
  - Edit and delete existing accounts
- Automatic credential migration from v1 (single account) to v2 (multi-account) format
- Scheduler fetches usage for all configured accounts in parallel
- Usage data now includes account_id and account_name for multi-account tracking
- History entries track which account the usage data came from

### Removed
- Compact view mode setting (smaller usage cards option)

## [0.14.0] - 2025-12-26

### Added
- Context menu on usage cards (right-click) with Copy, Refresh, and Open Provider actions
- Do Not Disturb schedule for notifications
  - Enable/disable DND mode in Settings
  - Configure quiet hours (e.g., 22:00 to 08:00)
  - Notifications are suppressed during DND window
- Notification preview button in Settings to test how notifications appear
- Confetti celebration animation when usage limits reset
- Compact view mode for smaller usage cards (toggle in Settings)

### Fixed
- macOS auto-updater now works correctly (added `app` to bundle targets for updater artifacts)

## [0.13.0] - 2025-12-26

### Added
- Global keyboard shortcut to show/hide window (configurable in Settings)
  - Preset options: Cmd/Ctrl+Shift+A, Cmd/Ctrl+Shift+P, Cmd/Ctrl+Shift+U, Alt+Shift+A, Alt+Shift+P
  - Works system-wide when app is running
- Copy usage to clipboard functionality
  - Copy button in header copies all usage data as formatted text
  - Individual usage cards have copy button on hover
- Configurable notification thresholds in Settings (25%, 50%, 75%, 90%, 95%)
- Skeleton loading states for usage cards while data is loading
- Enhanced progress ring animations
  - Smoother transitions (700ms ease-out)
  - Glow effect when usage is high (90%+)
  - Pulse animation on percentage text for high usage

### Changed
- Replaced deprecated `tauri-plugin-shell` with `tauri-plugin-opener` for opening URLs

## [0.12.0] - 2025-12-25

### Added
- Onboarding wizard for first-time setup with step-by-step credential guide
- Test Connection button to verify credentials before saving (in both onboarding and settings)
- `test_connection` command with detailed error codes and user-friendly hints
- Session management with auto-pause scheduler on repeated errors
  - SessionBanner component shows when credentials need refresh
  - Auto-pauses scheduler after 3 consecutive session errors
  - Auto-resumes when valid credentials are saved
  - `session-status` events for frontend state management
- "Open Claude.ai" quick action in tray menu and session banner
- `resume_scheduler` and `get_session_status` commands
- Provider registry for multi-provider support (Rust backend)
- Settings now shows all providers with availability status (Available/Blocked)
- `list_providers` command for frontend to query provider metadata
- Comprehensive API integration research for ChatGPT and Gemini in `docs/api-integration.md`

### Improved
- Error messages now include specific remediation steps for common issues (session expired, rate limited, etc.)
- Tray menu now has separator and "Open Claude.ai" quick action

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
