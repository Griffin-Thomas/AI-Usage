# Architecture

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri App                                │
├──────────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐  │
│  │ System Tray  │ │ Main Window  │ │ Settings Panel           │  │
│  │ - Quick view │ │ - Dashboard  │ │ - Account manager        │  │
│  │ - Menu       │ │ - Analytics  │ │ - Refresh intervals      │  │
│  │ - Refresh    │ │ - History    │ │ - Notifications          │  │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  Rust Backend                                                    │
│  ┌─────────────────────┐ ┌─────────────────────────────────────┐ │
│  │ Provider Adapters   │ │ Core Services                       │ │
│  │ - ClaudeProvider    │ │ - SchedulerService                  │ │
│  │ - (future: Codex)   │ │ - NotificationService               │ │
│  │ - (future: Gemini)  │ │ - HistoryService                    │ │
│  └─────────────────────┘ │ - CredentialService                 │ │
│                          └─────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ Storage Layer                                                ││
│  │ - Store plugin (credentials, settings, history)              ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## Technology Choices

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Tauri v2 | Cross-platform, small bundle (~3MB), native performance |
| Frontend | React 19 + TypeScript | Component-based, type safety |
| UI | shadcn/ui + Tailwind v4 | Modern, accessible, customizable |
| State | Zustand | Lightweight, TypeScript-first |
| Charts | Recharts | Usage visualization |
| HTTP | tauri-plugin-http | Native client with cookie support |
| Storage | tauri-plugin-store | Encrypted JSON for settings/credentials |
| Notifications | tauri-plugin-notification | Native desktop alerts |
| Tray | Tauri Tray API | Menu bar/system tray |
| Updater | tauri-plugin-updater | Auto-updates |

## File Structure

```
AI-Pulse/
├── src/                          # Frontend (React)
│   ├── components/
│   │   ├── ui/                   # shadcn components
│   │   ├── About.tsx             # About dialog
│   │   ├── AccountManager.tsx    # Multi-account management
│   │   ├── Analytics.tsx         # Usage charts and stats
│   │   ├── Confetti.tsx          # Reset celebration animation
│   │   ├── Dashboard.tsx         # Main usage view
│   │   ├── Onboarding.tsx        # First-run setup wizard
│   │   ├── ProgressRing.tsx      # Circular progress indicator
│   │   ├── SessionBanner.tsx     # Session expiry warning
│   │   ├── Settings.tsx          # Settings panel
│   │   ├── UpdateChecker.tsx     # Update notification UI
│   │   └── UsageCard.tsx         # Individual usage limit card
│   ├── hooks/
│   │   ├── useGlobalShortcut.ts  # Keyboard shortcut handling
│   │   └── useUsage.ts           # Usage data fetching/state
│   ├── lib/
│   │   ├── tauri.ts              # Tauri command wrappers
│   │   ├── store.ts              # Zustand stores
│   │   ├── tray.ts               # Tray icon updates
│   │   ├── types.ts              # TypeScript types
│   │   └── utils.ts              # Utility functions
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── error.rs              # Error types
│   │   ├── models.rs             # Data structures
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── accounts.rs       # Account CRUD commands
│   │   │   ├── credentials.rs    # Legacy credential commands
│   │   │   ├── history.rs        # History queries
│   │   │   ├── scheduler.rs      # Scheduler control
│   │   │   ├── settings.rs       # Settings management
│   │   │   └── usage.rs          # Usage fetching
│   │   ├── providers/
│   │   │   ├── mod.rs            # Provider registry
│   │   │   ├── traits.rs         # UsageProvider trait
│   │   │   └── claude.rs         # Claude API adapter
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── credentials.rs    # Account/credential storage
│   │   │   ├── history.rs        # Usage history storage
│   │   │   ├── notifications.rs  # Desktop notifications
│   │   │   ├── scheduler.rs      # Background refresh
│   │   │   └── settings.rs       # App settings
│   │   └── tray/
│   │       └── mod.rs            # System tray setup
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
│       └── default.json
├── docs/
│   ├── architecture.md
│   ├── data-models.md
│   ├── api-integration.md
│   └── user-guide.md
├── public/
│   └── icons/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── TASKS.md
├── CHANGELOG.md
└── README.md
```

## Key Features

### Multi-Account Support
- Store multiple accounts per provider
- Automatic migration from single-account to multi-account format
- Per-account session management and error tracking

### Background Scheduler
- Adaptive refresh intervals based on usage level
- Sleep/wake detection for immediate refresh
- Per-account pause on session errors

### Notifications
- Configurable threshold alerts (25%, 50%, 75%, 90%, 95%)
- Do Not Disturb scheduling
- Reset celebrations with confetti animation
