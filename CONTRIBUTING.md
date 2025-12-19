# Contributing to AI Pulse

Thank you for your interest in contributing to AI Pulse! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)

---

## Code of Conduct

Be respectful and constructive in all interactions. We're building software together.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- [Rust](https://rustup.rs/) toolchain (stable)
- [Git](https://git-scm.com/)

### Platform-Specific Requirements

#### macOS
- Xcode Command Line Tools: `xcode-select --install`

#### Windows
- Visual Studio Build Tools with "Desktop development with C++"
- WebView2 (usually pre-installed on Windows 10/11)

#### Linux
- Build essentials: `sudo apt install build-essential`
- WebKit2GTK: `sudo apt install libwebkit2gtk-4.1-dev`
- Additional libraries: `sudo apt install libssl-dev libayatana-appindicator3-dev librsvg2-dev`

---

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Griffin-Thomas/AI-Pulse.git
   cd AI-Pulse
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run tauri dev
   ```

   This starts both the Vite dev server and the Tauri application with hot reload.

### Useful Commands

```bash
# Run frontend tests
npm run test

# Run Rust tests
cargo test --manifest-path src-tauri/Cargo.toml

# Check Rust compilation
cargo check --manifest-path src-tauri/Cargo.toml

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run tauri build

# Generate app icons
npm run generate:icons
```

---

## Project Structure

```
AI-Pulse/
├── src/                    # React frontend (TypeScript)
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities, types, stores
│   └── test/               # Test setup and mocks
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── providers/      # API adapters (Claude, etc.)
│   │   └── services/       # Business logic
│   └── Cargo.toml          # Rust dependencies
├── docs/                   # Documentation
├── scripts/                # Build and utility scripts
└── .github/workflows/      # CI/CD pipelines
```

### Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main React application |
| `src/components/Dashboard.tsx` | Usage dashboard UI |
| `src/components/Analytics.tsx` | Analytics view |
| `src/lib/store.ts` | Zustand state stores |
| `src/lib/tray.ts` | Tray icon generation |
| `src-tauri/src/lib.rs` | Tauri app setup |
| `src-tauri/src/providers/claude.rs` | Claude API integration |
| `src-tauri/src/services/scheduler.rs` | Background refresh |

---

## Making Changes

### Before You Start

1. Check [existing issues](https://github.com/Griffin-Thomas/AI-Pulse/issues) for related work
2. For new features, open an issue first to discuss
3. Read `TASKS.md` to understand the project roadmap

### Branch Naming

Use descriptive branch names:
- `feature/add-gemini-support`
- `fix/session-expiry-notification`
- `docs/update-user-guide`

### Commit Messages

Write clear, concise commit messages:

```
Add usage heatmap to analytics dashboard

- Implement hourly/daily usage grid visualization
- Add colour scale for usage intensity
- Include peak usage pattern detection
```

---

## Pull Request Process

1. **Create a branch** from `main`
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes** following the coding standards

3. **Test your changes**
   ```bash
   npm run test:run
   cargo test --manifest-path src-tauri/Cargo.toml
   npm run lint
   ```

4. **Update documentation** if needed
   - Update `CHANGELOG.md` under "Unreleased"
   - Update `TASKS.md` if completing a task
   - Update relevant docs in `docs/`

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature
   ```

6. **Fill out the PR template** with:
   - Summary of changes
   - Related issues
   - Test plan

### PR Review

- PRs require review before merging
- Address feedback promptly
- Keep PRs focused and reasonably sized

---

## Coding Standards

### TypeScript (Frontend)

- Use strict mode (`"strict": true`)
- Avoid `any` types - use proper typing
- Use functional components with hooks
- Follow existing code patterns

```typescript
// Good
interface Props {
  usage: number;
  onRefresh: () => void;
}

function UsageCard({ usage, onRefresh }: Props) {
  // ...
}

// Avoid
function UsageCard(props: any) {
  // ...
}
```

### Rust (Backend)

- Use `?` operator for error propagation (no `unwrap()` in production)
- Follow the existing module structure
- Document public functions

```rust
// Good
pub async fn fetch_usage(org_id: &str) -> Result<UsageData, ProviderError> {
    let response = client.get(&url).send().await?;
    // ...
}

// Avoid
pub async fn fetch_usage(org_id: &str) -> UsageData {
    let response = client.get(&url).send().await.unwrap();
    // ...
}
```

### General

- Keep functions focused and small
- Add comments for non-obvious logic
- Match existing code style in the file
- Don't add unnecessary dependencies

---

## Testing

### Frontend Tests

Tests use Vitest with React Testing Library:

```typescript
// src/components/UsageCard.test.tsx
import { render, screen } from '@testing-library/react';
import { UsageCard } from './UsageCard';

describe('UsageCard', () => {
  it('displays usage percentage', () => {
    render(<UsageCard usage={75} limit="5-hour" resetTime="2h 30m" />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
```

Run tests:
```bash
npm run test        # Watch mode
npm run test:run    # Single run
```

### Rust Tests

```rust
// src-tauri/src/providers/claude.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_usage_response() {
        let json = r#"{"five_hour": {"utilization": 50.0, "resets_at": "..."}}"#;
        let usage = parse_response(json).unwrap();
        assert_eq!(usage.five_hour.utilization, 50.0);
    }
}
```

Run tests:
```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

### Testing Tauri Features

Tauri APIs only work inside the Tauri webview. For testing:

1. Mock Tauri APIs in `src/test/setup.ts`
2. Use `npm run tauri dev` for integration testing

---

## Adding a New Provider

To add support for a new AI service (e.g., Gemini):

1. **Create the Rust adapter**
   ```
   src-tauri/src/providers/gemini.rs
   ```
   Implement the `UsageProvider` trait.

2. **Register the provider**
   ```
   src-tauri/src/providers/mod.rs
   ```

3. **Add credential storage**
   ```
   src-tauri/src/services/credentials.rs
   ```

4. **Create UI configuration**
   ```
   src/components/ProviderConfig.tsx
   ```

5. **Update types** in both TypeScript and Rust

See `docs/api-integration.md` for API endpoint research.

---

## Questions?

- Open a [GitHub Discussion](https://github.com/Griffin-Thomas/AI-Pulse/discussions)
- Check existing [Issues](https://github.com/Griffin-Thomas/AI-Pulse/issues)

Thank you for contributing!
