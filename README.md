# AI Usage Monitor

A cross-platform desktop application for monitoring AI service usage quotas (Claude, OpenAI Codex).

## Features

- **Cross-platform** - Windows, macOS, Linux
- **Multi-provider** - Claude + OpenAI Codex (extensible)
- **System tray** - Quick access from menu bar
- **Usage analytics** - Historical tracking and trends
- **Notifications** - Alerts when approaching limits
- **Offline support** - Cached state, graceful degradation

## Preview

![Interface](docs/assets/GUI.png)

## Support

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/griffinthomas)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) toolchain

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Run the App

```bash
# Install dependencies
npm install

# Start development server
npm run tauri dev
```

### Configure Credentials

1. Click the **Settings** icon (gear) in the app header
2. Enter your Claude credentials:
   - **Organization ID**: Found in your Claude.ai URL (`claude.ai/settings/organization/[org-id]`)
   - **Session Key**: Found in browser DevTools → Application → Cookies → `sessionKey`
3. Click **Save Credentials**
4. Your usage data will be fetched automatically

## Tech Stack

- **Tauri v2** - Cross-platform framework (Rust backend)
- **React 19 + TypeScript** - Frontend UI
- **shadcn/ui + Tailwind CSS v4** - Components and styling
- **Zustand** - State management

## Development

### Commands

```bash
# Install dependencies
npm install

# Run in development (with hot reload)
npm run tauri dev

# Build frontend only
npm run build

# Check Rust compilation
cargo check --manifest-path src-tauri/Cargo.toml

# Build for production
npm run tauri build
```

### Project Structure

```
src/                    # React frontend
├── components/         # UI components
├── hooks/              # Custom React hooks
└── lib/                # Utilities and Tauri bindings

src-tauri/src/          # Rust backend
├── commands/           # Tauri command handlers
├── providers/          # API adapters (Claude, Codex)
└── services/           # Business logic (credentials, settings)
```

### Getting Claude Credentials

1. Log in to [claude.ai](https://claude.ai)
2. Navigate to Settings → Organization
3. Copy the org ID from the URL
4. Open DevTools (F12) → Application → Cookies → claude.ai
5. Copy the `sessionKey` cookie value

## Documentation

- [Architecture](docs/architecture.md)
- [API Integration](docs/api-integration.md)
- [Data Models](docs/data-models.md)

## License

MIT
