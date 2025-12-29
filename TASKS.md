# Tasks

## Phase 1: Core Foundation (Claude Support)

### 1.1 Project Setup
- [x] Initialize Tauri v2 project with React + TypeScript template
- [x] Configure Tailwind CSS and shadcn/ui
- [x] Set up ESLint, Prettier, TypeScript strict mode
- [x] Configure Tauri plugins: http, store, stronghold, notification, tray
- [x] Create project structure (src/components, src/hooks, src/lib, src-tauri/src)

### 1.2 Credential Management
- [x] Create `CredentialService` Rust module using Store plugin
- [x] Implement secure storage for Claude org ID and session key
- [x] Create settings UI for credential input
- [x] Add validation for credential format
- [x] Implement credential update/delete functionality

### 1.3 Claude API Integration
- [x] Create `ClaudeAdapter` trait/struct in Rust
- [x] Implement HTTP client with browser-like headers (Cloudflare bypass)
- [x] Parse usage response into typed structs
- [x] Handle error cases: 401 (expired), 403 (blocked), 429 (rate limit)
- [x] Expose to frontend via Tauri commands

### 1.4 System Tray Implementation
- [x] Create tray icon with dynamic percentage display
- [x] Implement tray menu: Show Dashboard, Refresh, Settings, Quit
- [x] Add colour-coded icon states (green/yellow/red based on usage)
- [x] Handle tray click events (show/hide main window)
- [x] Implement tray tooltip with usage summary

### 1.5 Dashboard UI
- [x] Create main dashboard layout with usage cards
- [x] Implement circular progress rings (5-hour + weekly limits)
- [x] Add countdown timers to limit resets
- [x] Add manual refresh button with debounce
- [x] Implement loading and error states

### 1.6 Settings UI
- [x] Create settings window/modal
- [x] Provider configuration section (Claude credentials)
- [x] Refresh interval selector (1/3/5/10 min or adaptive)
- [x] Display mode options (icon only, percentage, combined)
- [x] Launch at startup toggle
- [x] Theme selector (light/dark/system)

### 1.7 Refresh Scheduler
- [x] Implement background refresh scheduler in Rust
- [x] Support fixed intervals (1/3/5/10 minutes)
- [x] Implement adaptive refresh (adjust based on usage level)
- [x] Handle app lifecycle (detect sleep/wake via time gap, refresh on wake)
- [x] Rate limit protection (min 10s between requests)

### 1.8 Notifications
- [x] Implement usage threshold notifications (50%, 75%, 90%)
- [x] Add notification for limit reset
- [x] Create notification for session expiry
- [x] User-configurable notification preferences (via AppSettings.notifications)
- [x] Platform-native notification styling (via tauri-plugin-notification)

---

## Phase 2: Usage Analytics & History

### 2.1 History Storage
- [x] Design history data schema (timestamp, provider, usage snapshot)
- [x] Implement `HistoryManager` in Rust with Store plugin
- [x] Create data retention policies (keep last 30/90 days)
- [x] Implement history queries (by date range, provider)
- [x] Add data export functionality (JSON/CSV)

### 2.2 Analytics Dashboard
- [x] Create usage trend charts (daily/weekly/monthly)
- [x] Implement usage heatmap (usage patterns by hour/day)
- [x] Show peak usage times and patterns
- [x] Calculate average usage statistics
- [x] Add comparison view (current vs. previous period)

---

## Phase 3: Polish & Distribution

### 3.1 Testing
- [x] Unit tests for Rust backend (adapters, services)
- [x] Integration tests for API interactions (mocked)
- [x] Frontend component tests with Vitest

### 3.2 Platform-Specific Polish
- [x] macOS: Native menu bar integration (AI Pulse, Edit, View, Window menus with keyboard shortcuts)
- [x] macOS: Test notifications in production build
- [x] Windows: System tray behaviour (tooltip with instructions, left-click shows dashboard)
- [x] Linux: AppIndicator support, various desktop environments (documented requirements, left-click shows menu)

### 3.3 App Icon & Branding
- [x] Design custom app icon (usage meter/gauge concept)
- [x] Generate icon variants (16x16, 32x32, 128x128, 256x256, 512x512)
- [x] Create macOS .icns file
- [x] Create Windows .ico file
- [x] Design tray icon variants (green/yellow/red states)

### 3.4 Build & Distribution
- [ ] Set up code signing (macOS, Windows). This is BLOCKED since it costs $99 USD/year for an Apple Developer account
- [x] Create installers: DMG (macOS), MSI/NSIS (Windows), AppImage/deb (Linux)
- [x] Implement auto-update mechanism
- [x] Create GitHub Releases workflow
- [x] Ensure only the necessary assets (installers) are created in a release

### 3.5 Documentation
- [x] Write user guide with screenshots
- [x] Document credential extraction process
- [x] Create contributing guidelines
- [x] Add troubleshooting section


---

## Phase 4: OpenAI ChatGPT Integration

**Status:** ⚠️ BLOCKED - OpenAI does not expose server-side usage tracking

### 4.1 Provider Abstraction
- [x] Define `UsageProvider` trait in Rust (already exists)
- [x] Refactor `ClaudeAdapter` to implement trait (already done as ClaudeProvider)
- [x] Create provider registry for dynamic provider loading
- [x] Update frontend to handle multiple providers
- [x] Add `list_providers` command for UI

### 4.2 ChatGPT Integration Research (BLOCKED)
- [x] Research ChatGPT usage API/dashboard endpoints
- [x] Document findings in `docs/api-integration.md`

**Finding:** Unlike Claude's `/api/organizations/{id}/usage` which returns utilization percentage,
ChatGPT only exposes `/public-api/conversation_limit` which returns cap limits (e.g., 80 messages)
but NOT current usage count. See `docs/api-integration.md` for full details.

---

## Phase 5: Google Gemini Integration

**Status:** ⚠️ BLOCKED - Requires complex Cloud Monitoring API setup

### 5.1 Gemini API Research
- [x] Research Gemini API usage/billing endpoints
- [x] Document authentication methods (API key, OAuth)
- [x] Identify usage data structure (token counts, rate limits)
- [x] Determine quota types (RPM, TPM, daily limits)
- [x] Document findings in `docs/api-integration.md`

**Finding:** Gemini Web (gemini.google.com) has no usage API like ChatGPT.
Gemini Developer API usage CAN be tracked via Google Cloud Monitoring API, but requires:
- Google Cloud project with billing enabled
- Cloud Monitoring API enabled
- Complex OAuth2/service account setup
- MQL/PromQL query knowledge

This complexity makes it impractical for a lightweight desktop app where users just want
to paste credentials like they do with Claude.

### 5.2-5.4 Gemini Implementation (DEFERRED)
Deferred until Google provides a simpler usage API or community demand justifies the complexity.

---

## Phase 6: User Experience Improvements

### 6.1 Onboarding & First Run
- [x] Create onboarding wizard for first-time setup
- [x] Add step-by-step credential extraction guide (text-based with code examples)
- [x] Add screenshots to credential extraction guide (onboarding_1-4.png in user guide)
- [x] Show credential validation status during setup
- [x] Add "Test Connection" button before saving credentials
- [x] Provide helpful error messages with specific remediation steps

### 6.2 Session Management
- [x] Detect when session key is about to expire (based on error patterns)
- [x] Show persistent banner when credentials need refresh
- [x] Add "Open Claude.ai" quick action to get fresh credentials
- [x] Implement session health indicator in tray menu
- [x] Auto-pause scheduler when session is invalid (avoid rate limiting)

### 6.3 Quick Actions & Shortcuts
- [x] Add "Open Claude.ai" to tray menu (opens in default browser)
- [x] Implement global keyboard shortcut to show/hide window (configurable)
- [x] Add keyboard shortcut to copy current usage as text
- [x] Quick share usage stats (copy to clipboard as formatted text)
- [x] Add context menu to usage cards with actions

### 6.4 Notification Improvements
- [x] Add configurable notification thresholds (not just 50/75/90%)
- [x] Implement "Do Not Disturb" schedule (e.g., mute during focus hours)
- [x] Show notification preview in settings

### 6.5 Visual Polish
- [x] Add smooth animations to progress rings
- [x] Implement skeleton loading states
- [x] Add confetti animation when usage resets

---

## Phase 7: Power User Features

### 7.1 Multi-Account Support (100% Complete)

#### Backend (Completed)
- [x] Add `Account` model with id, name, provider, credentials, createdAt
- [x] Update `UsageData` and `UsageHistoryEntry` with account fields
- [x] Refactor credential storage for account-based format with v1→v2 migration
- [x] Create account CRUD commands (list_accounts, save_account, delete_account, etc.)
- [x] Update scheduler to fetch all accounts and emit per-account events
- [x] Update notifications for account-aware deduplication (keys include account_id)

#### Frontend (Completed)
- [x] Add Tauri bindings for account commands in `src/lib/tauri.ts`
- [x] Update stores for multi-account usage tracking (accountId-keyed)
- [x] Add AccountManager component to Settings (list, add, edit, delete accounts)
- [x] Update Dashboard for grouped display (headers when 2+ accounts)
- [x] Update useUsage hook for per-account events

#### Original Requirements
- [x] Allow multiple Claude accounts (work, personal, etc.)
- [x] Show all accounts in dashboard (no switcher needed)
- [x] Display usage for all accounts in dashboard
- [x] Per-account notification preferences - Shared settings (simpler)
- [x] Show aggregated usage view across accounts - Tray shows worst-case

### 7.2 Data & Export Enhancements
- [ ] Add scheduled automatic exports (daily/weekly backup)
- [ ] Export to more formats (Markdown report, PDF)
- [ ] Import history from export files
- [ ] Sync history across devices (optional cloud sync)
- [ ] API endpoint for external integrations (localhost only)

### 7.3 Advanced Analytics
- [ ] Add trend forecasting based on historical patterns
- [ ] Show day-of-week and time-of-day patterns
- [ ] Calculate "usage efficiency" metrics
- [ ] Compare usage across different time periods
- [ ] Generate monthly usage reports (in-app or email)

### 7.4 Developer Features
- [ ] Add CLI companion tool (`ai-pulse status`, `ai-pulse history`)
- [ ] Implement local API server for IDE integrations
- [ ] Create VS Code extension showing usage in status bar
- [ ] Webhook support to push usage events to external services

---

## Future Nice-to-Have

### Multi-Provider UI (When Additional Providers Available)
- [ ] Update dashboard to show multiple providers
- [ ] Create provider switcher/tabs
- [ ] Implement per-provider settings
- [ ] Add aggregated usage view (total across providers)
- [ ] Update tray icon to reflect worst-case provider status

### Usage Predictions
- [ ] Implement usage rate calculation (messages/hour)
- [ ] Predict time until limit reached
- [ ] Show optimal usage recommendations
- [ ] Alert when on track to exceed limits

### Performance Optimization
- [ ] Profile and optimize memory usage
- [ ] Minimize CPU usage when idle
- [ ] Optimize bundle size (tree shaking, code splitting)
- [ ] Implement efficient data caching

### Platform-Specific Enhancements
- [ ] macOS: Menu bar-only mode (no dock icon)
- [ ] macOS: Today widget / Notification Center widget
- [ ] Windows: Windows 11 widget support
- [ ] Linux: GNOME extension alternative

### Community Features
- [ ] Anonymous usage statistics sharing (opt-in)
- [ ] Compare your usage patterns with community averages
- [ ] Leaderboard/gamification (optional)
- [ ] Usage tips community wiki

### AI-Powered Features
- [ ] Smart usage optimization suggestions
- [ ] Predict busy times based on global patterns
- [ ] Natural language queries about usage ("How much did I use last Monday?")

### Alternative Provider Workarounds
- [ ] ChatGPT: Client-side message counting (local only)
- [ ] ChatGPT: Manual usage input with reminders
- [ ] Gemini: Optional Cloud Monitoring integration for advanced users
- [ ] Generic provider template for custom integrations