# Architecture

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri App                                │
├──────────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐  │
│  │ System Tray  │ │ Main Window  │ │ Settings Window          │  │
│  │ - Quick view │ │ - Dashboard  │ │ - Provider config        │  │
│  │ - Menu       │ │ - Charts     │ │ - Refresh intervals      │  │
│  │ - Refresh    │ │ - History    │ │ - Notifications          │  │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  Rust Backend                                                    │
│  ┌─────────────────────┐ ┌─────────────────────────────────────┐ │
│  │ Provider Adapters   │ │ Core Services                       │ │
│  │ - ClaudeAdapter     │ │ - UsageScheduler                    │ │
│  │ - CodexAdapter      │ │ - NotificationService               │ │
│  │ - (future: Gemini)  │ │ - HistoryManager                    │ │
│  └─────────────────────┘ └─────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ Storage Layer                                                ││
│  │ - Stronghold (credentials) │ Store (settings, history)       ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## Technology Choices

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Tauri v2 | Cross-platform, small bundle (~3MB), native performance |
| Frontend | React + TypeScript | Component-based, type safety |
| UI | shadcn/ui + Tailwind | Modern, accessible, customizable |
| State | Zustand | Lightweight, TypeScript-first |
| Charts | Recharts | Usage visualization |
| HTTP | tauri-plugin-http | Native client with cookie support |
| Storage | tauri-plugin-store | Encrypted JSON for settings |
| Secrets | tauri-plugin-stronghold | OS keychain for credentials |
| Notifications | tauri-plugin-notification | Native desktop alerts |
| Tray | Tauri Tray API | Menu bar/system tray |

## File Structure

```
ai-usage-monitor/
├── src/                          # Frontend (React)
│   ├── components/
│   │   ├── ui/                   # shadcn components
│   │   ├── Dashboard.tsx
│   │   ├── UsageCard.tsx
│   │   ├── ProgressRing.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── ProviderConfig.tsx
│   │   ├── HistoryChart.tsx
│   │   └── TrayMenu.tsx
│   ├── hooks/
│   │   ├── useUsage.ts
│   │   ├── useSettings.ts
│   │   └── useNotifications.ts
│   ├── lib/
│   │   ├── tauri.ts              # Tauri command wrappers
│   │   ├── store.ts              # Zustand store
│   │   └── utils.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── usage.rs
│   │   │   └── settings.rs
│   │   ├── providers/
│   │   │   ├── mod.rs
│   │   │   ├── traits.rs
│   │   │   ├── claude.rs
│   │   │   └── codex.rs
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── scheduler.rs
│   │   │   ├── credentials.rs
│   │   │   ├── history.rs
│   │   │   └── notifications.rs
│   │   └── tray/
│   │       └── mod.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
│       └── default.json
├── public/
│   └── icons/
├── tests/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── docs/
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
├── TASKS.md
└── README.md
```

## Success Metrics

| Metric | Target |
|--------|--------|
| Bundle size | < 5MB |
| Memory (idle) | < 30MB |
| CPU (idle) | < 0.1% |
| Startup time | < 2s |
| Refresh latency | < 1s |
