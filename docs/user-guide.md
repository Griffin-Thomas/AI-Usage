# AI Pulse User Guide

A comprehensive guide to using AI Pulse for monitoring your AI service usage.

## Table of Contents

- [Getting Started](#getting-started)
- [Dashboard](#dashboard)
- [Multi-Account Support](#multi-account-support)
- [System Tray](#system-tray)
- [Settings](#settings)
- [Updates](#updates)
- [Analytics](#analytics)
- [Notifications](#notifications)
- [Credential Setup](#credential-setup)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

#### macOS

1. Download the `.dmg` file from [Releases](https://github.com/Griffin-Thomas/AI-Pulse/releases)
2. Open the DMG and drag AI Pulse to your Applications folder
3. **Important**: Before first launch, run this command in Terminal:
   ```bash
   xattr -cr "/Applications/AI Pulse.app"
   ```
   This removes the quarantine attribute for unsigned apps.
4. Launch AI Pulse from Applications

#### Windows

1. Download the `.exe` installer from [Releases](https://github.com/Griffin-Thomas/AI-Pulse/releases)
2. Run the installer and follow the prompts
3. Launch AI Pulse from the Start menu

#### Linux

1. Download the `.AppImage` from [Releases](https://github.com/Griffin-Thomas/AI-Pulse/releases)
2. Make it executable: `chmod +x AI-Pulse*.AppImage`
3. Run the AppImage

### First Launch

On first launch, AI Pulse will guide you through a setup wizard to configure your credentials.

#### Step 1: Welcome

The welcome screen introduces AI Pulse and its key features.

<p align="center">
  <img src="assets/onboarding_1.png" alt="Welcome Screen" width="400">
</p>

#### Step 2: Credential Guide

Follow the step-by-step instructions to get your Claude credentials.

<p align="center">
  <img src="assets/onboarding_2.png" alt="Credential Guide" width="400">
</p>

#### Step 3: Enter Credentials

Paste your Organization ID and Session Key, then click **Test Connection** to verify they work.

<p align="center">
  <img src="assets/onboarding_3.png" alt="Enter Credentials" width="400">
</p>

#### Step 4: All Set!

Once connected, you're ready to start monitoring your usage.

<p align="center">
  <img src="assets/onboarding_4.png" alt="Setup Complete" width="400">
</p>

For detailed instructions on obtaining your credentials, see [Credential Setup](#credential-setup)

---

## Dashboard

The main dashboard displays your current AI usage across different limits.

<p align="center">
  <img src="assets/usage.png" alt="AI Pulse Dashboard Usage" width="400">
</p>

### Usage Cards

Each usage limit is displayed as a card showing:

- **Progress Ring**: Visual indicator of usage percentage
- **Percentage**: Current usage level
- **Time Remaining**: Countdown until the limit resets

### Colour Coding

Usage levels are colour-coded for quick recognition:

| Colour | Usage Level | Meaning |
|-------|-------------|---------|
| Green | 0-49% | Safe usage level |
| Yellow | 50-74% | Moderate usage |
| Orange | 75-89% | High usage, be cautious |
| Red | 90-100% | Critical, near limit |

### Refresh Button

Click the refresh button (circular arrow) to manually fetch the latest usage data. The button is debounced to prevent excessive API calls.

---

## Multi-Account Support

AI Pulse supports tracking multiple Claude accounts simultaneously, perfect for users who have separate work and personal accounts.

### Adding Multiple Accounts

1. Go to **Settings** (gear icon)
2. In the **Accounts** section, click **Add Account**
3. Enter a friendly name (e.g., "Work", "Personal")
4. Enter the Organization ID and Session Key for that account
5. Click **Test** to verify, then **Add Account**

Repeat for each account you want to track.

### Dashboard Display

When you have multiple accounts:
- Each account's usage is displayed in its own section
- Account names appear as headers above each group of usage cards
- The dashboard shows all accounts at once for easy comparison

With a single account, no headers are shown (the UI remains unchanged from before).

### Tray Icon Behaviour

The system tray icon shows the **worst-case** usage across all your accounts:
- If your work account is at 80% and personal is at 30%, the tray shows 80%
- This ensures you're always aware of whichever account is closest to its limit

### Managing Accounts

In Settings > Accounts:
- **Edit**: Click the pencil icon to update an account's credentials
- **Delete**: Click the trash icon to remove an account
- **Test Connection**: Verify credentials are valid before saving

### Notifications

Notifications are shared across all accounts - the same threshold settings apply to each. When a notification is sent, it includes the account name so you know which account triggered it:

> [Work] 5-Hour Limit is at 90% usage

---

## System Tray

AI Pulse runs in your system tray for quick access to usage information.

### Tray Icon

The tray icon displays a progress ring showing your current highest usage level:

- The ring fills based on usage percentage
- Colour changes based on usage level (green/yellow/orange/red)

### Tray Menu

Right-click (or click on macOS) the tray icon to access:

- **Show Dashboard**: Open the main window
- **Refresh**: Manually refresh usage data
- **Settings**: Open settings
- **Quit**: Exit the application

### Tray Tooltip

Hover over the tray icon to see a summary of all your usage limits.

![Tray Tooltip](assets/tray_tooltip.png)

### Platform-Specific Behaviour

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Tray Icon | ✅ Template mode (adapts to dark/light) | ✅ Standard | ✅ Requires AppIndicator |
| Tooltip on Hover | ✅ | ✅ | ❌ Not supported |
| Left-click | Shows dashboard | Shows dashboard | Shows menu |
| Right-click | Shows menu | Shows menu | Shows menu |
| Menu Bar | ✅ Native app menu | Window menu | Window menu |

**macOS Notes:**
- The app includes a native menu bar (AI Pulse, Edit, View, Window menus)
- Keyboard shortcuts:
  - `Cmd+,` to toggle Settings (open/close)
  - `Cmd+R` to refresh usage data
  - `Cmd+1` for Current Usage tab
  - `Cmd+2` for Analytics tab

**Linux Notes:**
- Tray tooltip is not supported on Linux
- Left-click shows the menu directly (standard Linux behaviour)
- Some desktop environments require AppIndicator support:
  - **GNOME**: Install `gnome-shell-extension-appindicator`
  - **KDE Plasma**: Usually works by default
  - **XFCE**: Install `xfce4-indicator-plugin`
  - **Cinnamon**: Install `xapp` package

---

## Settings

Access settings by clicking the gear icon in the dashboard header.

### Accounts

Manage your Claude accounts:

- **Add Account**: Create a new account with credentials
- **Edit Account**: Update an existing account's name or credentials
- **Delete Account**: Remove an account from tracking
- **Test Connection**: Verify credentials work before saving

For each account, you'll need:
- **Account Name**: A friendly name (e.g., "Work", "Personal")
- **Organization ID**: Your Claude organization identifier
- **Session Key**: Your authentication session key

See [Credential Setup](#credential-setup) for detailed instructions on obtaining these values.

### Refresh Interval

Choose how often the app fetches usage data:

| Interval | Description |
|----------|-------------|
| 1 minute | Most frequent updates |
| 3 minutes | Balanced frequency |
| 5 minutes | Standard interval |
| 10 minutes | Less frequent updates |
| Adaptive | Automatically adjusts based on usage level |

**Adaptive Mode**: When enabled, the refresh interval adjusts dynamically:
- 90%+ usage: Every 1 minute
- 75%+ usage: Every 3 minutes
- 50%+ usage: Every 5 minutes
- Below 50%: Every 10 minutes

### Menu Bar Display

Choose which usage limit to display in the system tray:

- **Highest Usage**: Shows the limit with the highest utilization
- **5-Hour Limit**: Always shows the 5-hour rolling limit
- **Weekly Limit**: Always shows the 7-day limit

### Theme

Select your preferred appearance:

- **System**: Follows your operating system theme
- **Light**: Light background with dark text
- **Dark**: Dark background with light text
- **Pink**: Pink! Added this for my fiancée

### Launch at Startup

Enable to automatically start AI Pulse when you log in.

---

## Updates

AI Pulse includes automatic update functionality to keep you on the latest version.

### Automatic Update Checks

When a new version is available, AI Pulse will notify you with a system notification. You can then choose to install the update or defer it for later.

### Manual Update Check

To manually check for updates:

1. Click **AI Pulse** in the menu bar (macOS) or right-click the tray icon
2. Select **About AI Pulse**
3. Click **Check for Updates**

If an update is available, you'll be prompted to download and install it. The app will restart automatically after the update completes.

### Update Process

1. AI Pulse downloads the update in the background
2. You're prompted to restart when ready
3. The update is applied during restart
4. Your settings and data are preserved

---

## Analytics

Switch to the Analytics tab to view your usage history and patterns.

<p align="center">
  <img src="assets/analytics.png" alt="AI Pulse Dashboard Analytics" width="400">
</p>

### Usage Trends

View usage over time with interactive line charts:

- **24 hours**: Recent usage patterns
- **7 days**: Weekly trends
- **30 days**: Monthly overview
- **All**: Complete history

### Usage Heatmap

Visualize when you use Claude most frequently:

- Rows represent hours of the day (0-23)
- Columns represent days of the week
- Colour intensity shows usage level

### Statistics

View aggregate statistics:

- **Data Points**: Total number of usage snapshots
- **Retention**: How long data is kept
- **Average Usage**: Mean usage percentage
- **Max Usage**: Highest recorded usage

### Peak Patterns

Identify your usage patterns:

- **Busiest Hour**: Hour with highest average usage
- **Quietest Hour**: Hour with lowest average usage
- **Busiest Day**: Day of week with highest usage
- **Quietest Day**: Day of week with lowest usage

### Period Comparison

Compare current period usage against the previous period to see trends.

### Export Data

Export your usage history:

- **JSON**: Machine-readable format
- **CSV**: Spreadsheet-compatible format

### Clear History

Remove all stored usage history data.

---

## Notifications

AI Pulse sends system notifications to keep you informed about your usage.

### Threshold Alerts

Receive notifications when usage reaches certain levels:

- **50%**: Moderate usage warning
- **75%**: High usage warning
- **90%**: Critical usage warning

### Reset Notifications

Get notified when your usage limit resets (drops 40%+ from a high level).

### Upcoming Reset Warnings

Receive alerts when a reset is approaching (within 1 hour) and your usage is high.

### Session Expiry

Get notified if your session key expires and needs to be refreshed.

---

## Credential Setup

### Getting Your Claude Credentials

#### Organization ID

1. Log in to [claude.ai](https://claude.ai)
2. Go to **Settings** (click your profile picture)
3. Navigate to **Organization** settings
4. Copy the Organization ID from the URL:
   ```
   https://claude.ai/settings/organization/YOUR-ORG-ID-HERE
   ```
   The ID looks like: `1d9fg082-995d-7f93-a619-3f8818bec3ab`
   

#### Session Key

1. Log in to [claude.ai](https://claude.ai)
2. Open your browser's Developer Tools:
   - **Chrome/Edge**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Firefox**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Safari**: Enable Developer menu in Preferences, then `Cmd+Option+I`
3. Go to the **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
4. In the left sidebar, expand **Cookies** and click on `https://claude.ai`
5. Find the cookie named `sessionKey`
6. Copy the entire **Value** (it starts with `sk-`)

**Note**: Session keys expire periodically. You'll need to repeat this process when you receive a session expiry notification.

---

## Troubleshooting

### App Won't Open (macOS)

**Problem**: macOS blocks the app because it's from an unidentified developer.

**Solution**: Run this command in Terminal before opening:
```bash
xattr -cr "/Applications/AI Pulse.app"
```

### "401 Unauthorized" Error

**Problem**: Your session key has expired.

**Solution**: Get a new session key from Claude.ai (see [Session Key](#session-key)) and update it in Settings.

### "403 Forbidden" Error

**Problem**: The request was blocked by Cloudflare protection.

**Solution**: This is rare. Try again in a few minutes. If persistent, your IP may be temporarily blocked.

### "429 Rate Limited" Error

**Problem**: Too many requests in a short period.

**Solution**: Wait a minute before refreshing. The app has built-in rate limiting (minimum 10s between requests).

### Usage Data Not Updating

**Problem**: Dashboard shows stale data.

**Solution**:
1. Click the manual refresh button
2. Check that your credentials are valid
3. Verify your internet connection
4. Check Settings to ensure background refresh is enabled

### Notifications Not Appearing

**Problem**: System notifications aren't showing.

**Solution**:
- **macOS**: Check System Settings > Notifications > AI Pulse
- **Windows**: Check Settings > System > Notifications
- **Linux**: Ensure a notification daemon is running

### Tray Icon Not Visible

**Problem**: The system tray icon isn't appearing.

**Solution**:
- **Windows**: Check hidden icons in the system tray overflow
- **Linux**: Ensure AppIndicator support is installed for your desktop environment:
  - GNOME: Install `gnome-shell-extension-appindicator`
  - KDE: Usually works by default
  - XFCE: Install `xfce4-indicator-plugin`

### High CPU or Memory Usage

**Problem**: The app is using excessive resources.

**Solution**:
1. Increase the refresh interval in Settings
2. Close and reopen the app
3. Check for app updates

### App Crashes on Startup

**Problem**: The app fails to launch.

**Solution**:
1. Delete the app's data directory and try again:
   - **macOS**: `~/Library/Application Support/com.aipulse.app/`
   - **Windows**: `%APPDATA%\com.aipulse.app\`
   - **Linux**: `~/.local/share/com.aipulse.app/`
2. Reinstall the app
3. Report the issue with logs at [GitHub Issues](https://github.com/Griffin-Thomas/AI-Pulse/issues)

---

## Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/Griffin-Thomas/AI-Pulse/issues) for known problems
2. Create a new issue with:
   - Your operating system and version
   - App version (shown in Settings)
   - Steps to reproduce the problem
   - Any error messages

## Support Development

If you find AI Pulse useful, consider supporting development:

<a href="https://buymeacoffee.com/griffinthomas">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180">
</a>
