# AI Pulse CLI

The `ai-pulse` command-line tool provides quick access to your AI usage data from the terminal.

## Prerequisites

The CLI requires the AI Pulse desktop app to be running with the Local API Server enabled:

1. Open AI Pulse
2. Go to **Settings** → **Developer**
3. Enable **Local API Server**
4. Restart AI Pulse

## Installation

### Build from Source

```bash
cd cli
cargo build --release
```

The binary will be at `target/release/ai-pulse`.

### Add to PATH

```bash
# macOS/Linux
cp target/release/ai-pulse /usr/local/bin/

# Or add to your shell config
export PATH="$PATH:/path/to/ai-pulse/cli/target/release"
```

## Configuration

The CLI stores its configuration in `~/.config/ai-pulse/cli.toml`:

```toml
port = 31415
token = "your-auth-token"
```

### Configure via Commands

```bash
# View current config
ai-pulse config show

# Set the API server port
ai-pulse config set port 31415

# Set the auth token
ai-pulse config set token "your-auth-token"

# Clear the auth token
ai-pulse config set token ""
```

### Copy Config from App

In AI Pulse Settings → Developer, there's a "CLI Configuration" section with a copy button that generates the config for you.

## Commands

### status

Show current usage for all accounts.

```bash
# Show usage with coloured output
ai-pulse status

# Output as JSON (for scripting)
ai-pulse status --json

# Filter by account name or ID
ai-pulse status --account personal
ai-pulse status -a work
```

**Example Output:**
```
AI Pulse Usage Status
━━━━━━━━━━━━━━━━━━━━━

● Personal (claude)
  5-Hour Limit     ████████░░  82%  Resets in 2h 15m
  Weekly Limit     ██████░░░░  58%  Resets in 3d 4h

● Work (claude)
  5-Hour Limit     ██░░░░░░░░  23%  Resets in 4h 30m
  Weekly Limit     █░░░░░░░░░  12%  Resets in 5d 2h
```

### history

View usage history.

```bash
# Show last 24 hours (default)
ai-pulse history

# Show last 7 days
ai-pulse history --days 7

# Limit number of entries
ai-pulse history --limit 50

# Output as JSON
ai-pulse history --json
```

**Example Output:**
```
Usage History (last 7 days)
━━━━━━━━━━━━━━━━━━━━━━━━━━

Personal (claude)
  2025-12-30 10:00 │ five_hour: 45%, seven_day: 23%
  2025-12-30 09:00 │ five_hour: 42%, seven_day: 22%
  2025-12-29 18:00 │ five_hour: 38%, seven_day: 21%

Total: 156 entries
```

### refresh

Trigger an immediate usage refresh.

```bash
ai-pulse refresh
```

**Output:**
```
✓ Refresh triggered
```

Or if rate limited:
```
⚠ Rate limited. Please wait before refreshing again.
```

### config

Manage CLI configuration.

```bash
# Show current config
ai-pulse config show

# Set a value
ai-pulse config set port 8080
ai-pulse config set token "my-secret-token"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (connection failed, auth error, etc.) |

## Scripting Examples

### Get highest usage percentage
```bash
ai-pulse status --json | jq '[.accounts[].limits[].utilization] | max'
```

### Check if any account is above 80%
```bash
if ai-pulse status --json | jq -e '[.accounts[].limits[].utilization] | max > 80' > /dev/null; then
  echo "Warning: High usage detected!"
fi
```

### Daily usage log
```bash
# Add to crontab for daily logging
0 9 * * * ai-pulse status --json >> ~/ai-usage-log.jsonl
```

### Shell prompt integration
```bash
# Add to .bashrc or .zshrc
ai_usage() {
  local usage=$(ai-pulse status --json 2>/dev/null | jq -r '[.accounts[].limits[].utilization] | max | floor')
  if [ -n "$usage" ]; then
    echo "AI:${usage}%"
  fi
}
PS1='$(ai_usage) \$ '
```

## Troubleshooting

### "Could not connect to AI Pulse"

The CLI cannot reach the API server. Check that:
1. AI Pulse is running
2. Local API Server is enabled in Settings → Developer
3. The port in your CLI config matches the app settings

### "Authentication failed"

Your CLI token doesn't match the one in AI Pulse:
1. Open AI Pulse Settings → Developer
2. Copy the token or generate a new one
3. Run `ai-pulse config set token "your-token"`

### No output or frozen

The API server may be slow to respond. Check:
1. AI Pulse is not frozen or unresponsive
2. Try refreshing manually in the app first
