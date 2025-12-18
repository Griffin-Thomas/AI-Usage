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
- [ ] Integration tests for API interactions (mocked)
- [x] Frontend component tests with Vitest
- [ ] Cross-platform testing matrix

### 3.2 Performance Optimization
- [ ] Profile and optimize memory usage
- [ ] Minimize CPU usage when idle
- [ ] Optimize bundle size (tree shaking, code splitting)
- [ ] Implement efficient data caching

### 3.3 Platform-Specific Polish
- [ ] macOS: Native menu bar integration, Keychain prompts
- [ ] macOS: Test notifications in production build (dev builds don't show macOS notifications properly)
- [ ] Windows: System tray behaviour
- [ ] Linux: AppIndicator support, various desktop environments

### 3.4 App Icon & Branding
- [ ] Design custom app icon (usage meter/gauge concept)
- [ ] Generate icon variants (16x16, 32x32, 128x128, 256x256, 512x512)
- [ ] Create macOS .icns file
- [ ] Create Windows .ico file
- [ ] Design tray icon variants (green/yellow/red states)

### 3.5 Build & Distribution
- [ ] Set up code signing (macOS, Windows)
- [x] Create installers: DMG (macOS), MSI/NSIS (Windows), AppImage/deb (Linux)
- [ ] Implement auto-update mechanism
- [x] Create GitHub Releases workflow

### 3.6 Documentation
- [ ] Write user guide with screenshots
- [ ] Document credential extraction process
- [ ] Create contributing guidelines
- [ ] Add troubleshooting section


---

## Phase 4: OpenAI Codex Integration

### 4.1 Provider Abstraction
- [ ] Define `UsageProvider` trait in Rust
- [ ] Refactor `ClaudeAdapter` to implement trait
- [ ] Create provider registry for dynamic provider loading
- [ ] Update frontend to handle multiple providers

### 4.2 Codex Adapter Implementation
- [ ] Research Codex usage API/dashboard endpoints
- [ ] Implement `CodexAdapter` struct
- [ ] Handle Codex-specific auth (session token or API key)
- [ ] Parse Codex usage data (5-hour window, weekly limits)
- [ ] Map to common usage data model

### 4.3 Multi-Provider UI
- [ ] Update dashboard to show multiple providers
- [ ] Create provider switcher/tabs
- [ ] Implement per-provider settings
- [ ] Add aggregated usage view (total across providers)
- [ ] Update tray icon to reflect worst-case provider status

### 4.4 Codex-Specific Features
- [ ] Show task/message-based limits
- [ ] Display credits balance (if applicable)
- [ ] Model-specific usage breakdown (GPT-4o, Mini, etc.)
- [ ] CLI integration status indicator

---

## Phase 5: Google Gemini Integration

### 5.1 Gemini API Research
- [ ] Research Gemini API usage/billing endpoints
- [ ] Document authentication methods (API key, OAuth)
- [ ] Identify usage data structure (token counts, rate limits)
- [ ] Determine quota types (RPM, TPM, daily limits)

### 5.2 Gemini Adapter Implementation
- [ ] Create `GeminiAdapter` struct implementing `UsageProvider` trait
- [ ] Implement authentication (API key storage in credentials)
- [ ] Fetch usage data from Gemini API
- [ ] Parse quota and usage response into common model
- [ ] Handle error cases (401, 403, 429)

### 5.3 Gemini-Specific Features
- [ ] Display token usage (input/output tokens)
- [ ] Show rate limits (requests per minute, tokens per minute)
- [ ] Model-specific breakdown (Gemini Pro, Flash, Ultra)
- [ ] Billing/cost tracking if available
- [ ] Free tier vs paid tier indication

### 5.4 Multi-Provider Updates
- [ ] Add Gemini to provider selector in Settings
- [ ] Update dashboard to display Gemini usage cards
- [ ] Include Gemini in tray icon worst-case calculation
- [ ] Add Gemini-specific notification thresholds

---

## Future Nice-to-Have

### Usage Predictions
- [ ] Implement usage rate calculation (messages/hour)
- [ ] Predict time until limit reached
- [ ] Show optimal usage recommendations
- [ ] Alert when on track to exceed limits