# AI Usage Monitor

A cross-platform desktop application for monitoring AI service usage quotas (Claude, OpenAI Codex).

## Features

- **Cross-platform** - Windows, macOS, Linux
- **Multi-provider** - Claude + OpenAI Codex (extensible)
- **System tray** - Quick access from menu bar
- **Usage analytics** - Historical tracking and trends
- **Notifications** - Alerts when approaching limits
- **Offline support** - Cached state, graceful degradation

## Tech Stack

- **Tauri v2** - Cross-platform framework (Rust backend)
- **React + TypeScript** - Frontend UI
- **shadcn/ui + Tailwind** - Components and styling
- **Zustand** - State management

## Documentation

- [Architecture](docs/architecture.md)
- [API Integration](docs/api-integration.md)
- [Data Models](docs/data-models.md)

## Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm tauri dev

# Build for production
pnpm tauri build
```

## License

MIT
