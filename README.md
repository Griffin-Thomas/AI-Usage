# AI Pulse

A cross-platform desktop application for monitoring AI service usage quotas (Claude for now).

<p align="center">
  <img src="docs/assets/usage.png" alt="AI Pulse Dashboard Usage" width="400">
  <img src="docs/assets/analytics.png" alt="AI Pulse Dashboard Analytics" width="400">
</p>

<p align="center">
  <img src="docs/assets/usage_dark.png" alt="AI Pulse Dashboard Usage" width="400">
  <img src="docs/assets/analytics_dark.png" alt="AI Pulse Dashboard Analytics" width="400">
</p>

## Features

- **Real-time Usage Tracking** - Monitor your Claude API usage limits
- **System Tray Integration** - Dynamic progress ring icon shows usage at a glance
- **Smart Notifications** - Alerts at 50%, 75%, 90% usage thresholds
- **Background Refresh** - Automatic updates with adaptive intervals
- **Cross-platform** - macOS, Linux, Windows

## Installation

### macOS

1. Download the `.dmg` file from [Releases](https://github.com/Griffin-Thomas/AI-Pulse/releases)
2. Open the `.dmg` and drag AI Pulse to your Applications folder
3. Before opening, run this command to remove the quarantine attribute (required for unsigned apps):
   ```bash
   xattr -cr "/Applications/AI Pulse.app"
   ```
4. Open AI Pulse from Applications

### Windows

Download and run the `.exe` installer from [Releases](https://github.com/Griffin-Thomas/AI-Pulse/releases).

### Linux

Download the `.AppImage` from [Releases](https://github.com/Griffin-Thomas/AI-Pulse/releases), make it executable, and run it.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) toolchain

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

For detailed instructions, see the [User Guide](docs/user-guide.md).

## Tech Stack

- **Tauri v2** - Cross-platform framework (Rust backend)
- **React 19 + TypeScript** - Frontend UI
- **shadcn/ui + Tailwind CSS v4** - Components and styling
- **Zustand** - State management

## Support

<a href="https://buymeacoffee.com/griffinthomas">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180">
</a>

## License

MIT
