import { useState, useEffect, useCallback } from "react";
import { X, Loader2, Check, AlertTriangle, Clock, Bell, Terminal, Copy, Eye, EyeOff } from "lucide-react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountManager } from "@/components/AccountManager";
import {
  getSettings,
  saveSettings,
  setRefreshInterval as setSchedulerInterval,
  listProviders,
  sendTestNotification,
  type AppSettings,
} from "@/lib/tauri";
import type { ProviderMetadata, ProviderStatus } from "@/lib/types";
import { useSettingsStore, useUsageStore } from "@/lib/store";
import { updateTray } from "@/lib/tray";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialsSaved?: () => void;
}

const REFRESH_OPTIONS = [
  { value: 0, label: "Adaptive" },
  { value: 60, label: "1 minute" },
  { value: 180, label: "3 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
] as const;

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "pink", label: "Pink" },
] as const;

const TRAY_DISPLAY_OPTIONS = [
  { value: "highest", label: "Highest Usage" },
  { value: "five_hour", label: "5-Hour Limit" },
  { value: "seven_day", label: "Weekly Limit" },
] as const;

export function Settings({ isOpen, onClose, onCredentialsSaved }: SettingsProps) {
  // Settings state
  const { settings, setSettings } = useSettingsStore();
  const { getAllUsage } = useUsageStore();
  const [refreshInterval, setRefreshInterval] = useState<0 | 60 | 180 | 300 | 600>(300);
  const [theme, setTheme] = useState<"light" | "dark" | "system" | "pink">("dark");
  const [trayDisplayLimit, setTrayDisplayLimit] = useState<"highest" | "five_hour" | "seven_day">("highest");
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [isTogglingAutostart, setIsTogglingAutostart] = useState(false);
  const [providers, setProviders] = useState<ProviderMetadata[]>([]);

  const loadProviders = useCallback(async () => {
    try {
      const providerList = await listProviders();
      setProviders(providerList);
    } catch (err) {
      console.error("Failed to load providers:", err);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
      // If adaptive mode is enabled, show 0 (Adaptive) in dropdown
      if (loadedSettings.refreshMode === "adaptive") {
        setRefreshInterval(0);
      } else {
        setRefreshInterval(loadedSettings.refreshInterval);
      }
      setTheme(loadedSettings.theme);
      setTrayDisplayLimit(loadedSettings.trayDisplayLimit ?? "highest");

      // Check actual autostart status from system
      const autostartEnabled = await isEnabled();
      setLaunchAtStartup(autostartEnabled);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, [setSettings]);

  // Load settings and providers on open
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadProviders();
    }
  }, [isOpen, loadSettings, loadProviders]);

  const handleAutoStartToggle = async () => {
    setIsTogglingAutostart(true);
    try {
      if (launchAtStartup) {
        await disable();
        setLaunchAtStartup(false);
      } else {
        await enable();
        setLaunchAtStartup(true);
      }

      // Also update the settings store
      if (settings) {
        const newSettings = { ...settings, launchAtStartup: !launchAtStartup };
        setSettings(newSettings);
        await saveSettings(newSettings);
      }
    } catch (err) {
      console.error("Failed to toggle autostart:", err);
    } finally {
      setIsTogglingAutostart(false);
    }
  };

  const handleSettingChange = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    if (!settings) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Update local state
    if (key === "theme") {
      setTheme(value as typeof theme);
      applyTheme(value as typeof theme);
    }

    try {
      await saveSettings(newSettings);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const handleRefreshIntervalChange = async (selectedValue: number) => {
    if (!settings) return;

    const isAdaptive = selectedValue === 0;
    setRefreshInterval(selectedValue as typeof refreshInterval);

    const newSettings = {
      ...settings,
      refreshMode: isAdaptive ? "adaptive" : "fixed",
      // Keep existing refreshInterval when switching to adaptive, otherwise use selected value
      refreshInterval: isAdaptive ? settings.refreshInterval : (selectedValue as 60 | 180 | 300 | 600),
    } as const;

    setSettings(newSettings);

    // Update the scheduler's interval (for fixed mode)
    if (!isAdaptive) {
      try {
        await setSchedulerInterval(selectedValue);
      } catch (err) {
        console.error("Failed to update scheduler interval:", err);
      }
    }

    try {
      await saveSettings(newSettings);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const handleTrayDisplayLimitChange = async (selectedValue: string) => {
    if (!settings) return;

    const value = selectedValue as "highest" | "five_hour" | "seven_day";
    setTrayDisplayLimit(value);

    const newSettings = {
      ...settings,
      trayDisplayLimit: value,
    };

    setSettings(newSettings);

    // Immediately update the tray with the new setting (use first available usage)
    const allUsage = getAllUsage();
    if (allUsage.length > 0) {
      await updateTray(allUsage[0], value);
    }

    try {
      await saveSettings(newSettings);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const applyTheme = (newTheme: "light" | "dark" | "system" | "pink") => {
    const root = document.documentElement;
    root.classList.remove("dark", "pink");
    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.classList.add("dark");
    } else if (newTheme === "dark") {
      root.classList.add("dark");
    } else if (newTheme === "pink") {
      root.classList.add("pink");
    }
  };

  const getStatusIcon = (status: ProviderStatus) => {
    switch (status) {
      case "available":
        return <Check className="h-4 w-4 text-green-500" />;
      case "blocked":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "planned":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: ProviderStatus) => {
    switch (status) {
      case "available":
        return "Available";
      case "blocked":
        return "Blocked";
      case "planned":
        return "Coming Soon";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="fixed inset-4 flex items-start justify-center overflow-auto">
        <Card className="w-full max-w-lg mt-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Configure your AI service credentials</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Providers Overview */}
            {providers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Providers</h3>
                <div className="grid gap-2">
                  {providers.map((provider) => (
                    <div
                      key={provider.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        provider.status === "available"
                          ? "border-green-500/30 bg-green-500/5"
                          : provider.status === "blocked"
                          ? "border-yellow-500/30 bg-yellow-500/5"
                          : "border-muted bg-muted/5"
                      }`}
                    >
                      <div className="mt-0.5">{getStatusIcon(provider.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{provider.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            provider.status === "available"
                              ? "bg-green-500/20 text-green-600 dark:text-green-400"
                              : provider.status === "blocked"
                              ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {getStatusLabel(provider.status)}
                          </span>
                        </div>
                        {provider.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {provider.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Account Manager */}
            <AccountManager onAccountsChanged={onCredentialsSaved} />

            {/* App Settings */}
            <div className="pt-4 border-t space-y-4">
              <h3 className="text-sm font-medium">App Settings</h3>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="launch-at-startup">Launch at startup</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically start when you log in
                  </p>
                </div>
                <button
                  id="launch-at-startup"
                  role="switch"
                  aria-checked={launchAtStartup}
                  disabled={isTogglingAutostart}
                  onClick={handleAutoStartToggle}
                  className={`
                    relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                    transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                    disabled:cursor-not-allowed disabled:opacity-50
                    ${launchAtStartup ? "bg-primary" : "bg-input"}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0
                      transition-transform
                      ${launchAtStartup ? "translate-x-5" : "translate-x-0"}
                    `}
                  >
                    {isTogglingAutostart && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </span>
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refresh-interval">Refresh Interval</Label>
                <select
                  id="refresh-interval"
                  value={refreshInterval}
                  onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {REFRESH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {refreshInterval === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Refreshes more frequently as usage increases
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <select
                  id="theme"
                  value={theme}
                  onChange={(e) =>
                    handleSettingChange(
                      "theme",
                      e.target.value as "light" | "dark" | "system" | "pink"
                    )
                  }
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {THEME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tray-display">Menu Bar Display</Label>
                <select
                  id="tray-display"
                  value={trayDisplayLimit}
                  onChange={(e) => handleTrayDisplayLimitChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {TRAY_DISPLAY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Choose which usage limit to display in the menu bar icon
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="global-shortcut">Global Shortcut</Label>
                <select
                  id="global-shortcut"
                  value={settings?.globalShortcut ?? ""}
                  onChange={(e) => handleSettingChange("globalShortcut", e.target.value || null)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">None</option>
                  <option value="CommandOrControl+Shift+A">⌘/Ctrl + Shift + A</option>
                  <option value="CommandOrControl+Shift+P">⌘/Ctrl + Shift + P</option>
                  <option value="CommandOrControl+Shift+U">⌘/Ctrl + Shift + U</option>
                  <option value="Alt+Shift+A">Alt + Shift + A</option>
                  <option value="Alt+Shift+P">Alt + Shift + P</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Press this shortcut anywhere to show/hide the window
                </p>
              </div>

            </div>

            {/* Notification Settings */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Notifications</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await sendTestNotification();
                    } catch (err) {
                      console.error("Failed to send test notification:", err);
                    }
                  }}
                  className="h-7 text-xs"
                >
                  <Bell className="h-3 w-3 mr-1" />
                  Preview
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notifications-enabled">Enable notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Get alerted when usage reaches thresholds
                  </p>
                </div>
                <button
                  id="notifications-enabled"
                  role="switch"
                  aria-checked={settings?.notifications.enabled ?? true}
                  onClick={() => {
                    if (!settings) return;
                    const newNotifications = {
                      ...settings.notifications,
                      enabled: !settings.notifications.enabled,
                    };
                    handleSettingChange("notifications", newNotifications);
                  }}
                  className={`
                    relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                    transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                    ${settings?.notifications.enabled ? "bg-primary" : "bg-input"}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0
                      transition-transform
                      ${settings?.notifications.enabled ? "translate-x-5" : "translate-x-0"}
                    `}
                  />
                </button>
              </div>

              {settings?.notifications.enabled && (
                <>
                  <div className="space-y-3">
                    <Label>Usage thresholds</Label>
                    <p className="text-xs text-muted-foreground">
                      Notify when usage reaches these levels
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[25, 50, 75, 90, 95].map((threshold) => {
                        const isSelected = settings.notifications.thresholds.includes(threshold);
                        return (
                          <button
                            key={threshold}
                            onClick={() => {
                              const newThresholds = isSelected
                                ? settings.notifications.thresholds.filter((t) => t !== threshold)
                                : [...settings.notifications.thresholds, threshold].sort((a, b) => a - b);
                              const newNotifications = {
                                ...settings.notifications,
                                thresholds: newThresholds,
                              };
                              handleSettingChange("notifications", newNotifications);
                            }}
                            className={`
                              px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                              ${isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }
                            `}
                          >
                            {threshold}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notify-reset">Notify on reset</Label>
                      <p className="text-xs text-muted-foreground">
                        Alert when usage limits reset
                      </p>
                    </div>
                    <button
                      id="notify-reset"
                      role="switch"
                      aria-checked={settings.notifications.notifyOnReset}
                      onClick={() => {
                        const newNotifications = {
                          ...settings.notifications,
                          notifyOnReset: !settings.notifications.notifyOnReset,
                        };
                        handleSettingChange("notifications", newNotifications);
                      }}
                      className={`
                        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                        transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                        ${settings.notifications.notifyOnReset ? "bg-primary" : "bg-input"}
                      `}
                    >
                      <span
                        className={`
                          pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0
                          transition-transform
                          ${settings.notifications.notifyOnReset ? "translate-x-5" : "translate-x-0"}
                        `}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notify-expiry">Notify on session expiry</Label>
                      <p className="text-xs text-muted-foreground">
                        Alert when credentials need refresh
                      </p>
                    </div>
                    <button
                      id="notify-expiry"
                      role="switch"
                      aria-checked={settings.notifications.notifyOnExpiry}
                      onClick={() => {
                        const newNotifications = {
                          ...settings.notifications,
                          notifyOnExpiry: !settings.notifications.notifyOnExpiry,
                        };
                        handleSettingChange("notifications", newNotifications);
                      }}
                      className={`
                        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                        transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                        ${settings.notifications.notifyOnExpiry ? "bg-primary" : "bg-input"}
                      `}
                    >
                      <span
                        className={`
                          pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0
                          transition-transform
                          ${settings.notifications.notifyOnExpiry ? "translate-x-5" : "translate-x-0"}
                        `}
                      />
                    </button>
                  </div>

                  {/* Do Not Disturb */}
                  <div className="pt-3 border-t space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="dnd-enabled">Do Not Disturb</Label>
                        <p className="text-xs text-muted-foreground">
                          Mute notifications during scheduled hours
                        </p>
                      </div>
                      <button
                        id="dnd-enabled"
                        role="switch"
                        aria-checked={settings.notifications.dndEnabled}
                        onClick={() => {
                          const newNotifications = {
                            ...settings.notifications,
                            dndEnabled: !settings.notifications.dndEnabled,
                          };
                          handleSettingChange("notifications", newNotifications);
                        }}
                        className={`
                          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                          transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                          ${settings.notifications.dndEnabled ? "bg-primary" : "bg-input"}
                        `}
                      >
                        <span
                          className={`
                            pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0
                            transition-transform
                            ${settings.notifications.dndEnabled ? "translate-x-5" : "translate-x-0"}
                          `}
                        />
                      </button>
                    </div>

                    {settings.notifications.dndEnabled && (
                      <div className="flex gap-3 items-center">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="dnd-start" className="text-xs">From</Label>
                          <Input
                            id="dnd-start"
                            type="time"
                            value={settings.notifications.dndStartTime ?? "22:00"}
                            onChange={(e) => {
                              const newNotifications = {
                                ...settings.notifications,
                                dndStartTime: e.target.value,
                              };
                              handleSettingChange("notifications", newNotifications);
                            }}
                            className="h-9"
                          />
                        </div>
                        <span className="text-muted-foreground pt-5">to</span>
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="dnd-end" className="text-xs">Until</Label>
                          <Input
                            id="dnd-end"
                            type="time"
                            value={settings.notifications.dndEndTime ?? "08:00"}
                            onChange={(e) => {
                              const newNotifications = {
                                ...settings.notifications,
                                dndEndTime: e.target.value,
                              };
                              handleSettingChange("notifications", newNotifications);
                            }}
                            className="h-9"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Developer Settings */}
            <DeveloperSettings
              settings={settings}
              onSettingChange={handleSettingChange}
            />

            {/* Help section */}
            {/* <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-2">How to get your credentials</h3>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Log in to Claude.ai in your browser</li>
                <li>Go to Settings → Organization to find your Org ID</li>
                <li>Open DevTools (F12) → Application → Cookies</li>
                <li>Copy the value of the "sessionKey" cookie</li>
              </ol>
            </div> */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Developer Settings Component
// ============================================================================

interface DeveloperSettingsProps {
  settings: AppSettings | null;
  onSettingChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

function DeveloperSettings({ settings, onSettingChange }: DeveloperSettingsProps) {
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!settings) return null;

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onSettingChange('apiServerToken', token);
  };

  const copyCliConfig = async () => {
    const config = `port = ${settings.apiServerPort}
token = "${settings.apiServerToken || ''}"`;
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="pt-4 border-t space-y-4">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Developer</h3>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="api-server-enabled">Enable Local API Server</Label>
          <p className="text-xs text-muted-foreground">
            Allow CLI and IDE integrations to access usage data
          </p>
        </div>
        <button
          id="api-server-enabled"
          role="switch"
          aria-checked={settings.apiServerEnabled}
          onClick={() => onSettingChange('apiServerEnabled', !settings.apiServerEnabled)}
          className={`
            relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
            transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${settings.apiServerEnabled ? "bg-primary" : "bg-input"}
          `}
        >
          <span
            className={`
              pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0
              transition-transform
              ${settings.apiServerEnabled ? "translate-x-5" : "translate-x-0"}
            `}
          />
        </button>
      </div>

      {settings.apiServerEnabled && (
        <>
          <div className="space-y-2">
            <Label htmlFor="api-port">Port</Label>
            <Input
              id="api-port"
              type="number"
              min={1024}
              max={65535}
              value={settings.apiServerPort}
              onChange={(e) => {
                const port = parseInt(e.target.value, 10);
                if (port >= 1024 && port <= 65535) {
                  onSettingChange('apiServerPort', port);
                }
              }}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              API server will listen on localhost:{settings.apiServerPort}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="api-token">Auth Token (optional)</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateToken}
                className="h-6 text-xs"
              >
                Generate
              </Button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-token"
                  type={showToken ? "text" : "password"}
                  value={settings.apiServerToken || ''}
                  onChange={(e) => onSettingChange('apiServerToken', e.target.value || null)}
                  placeholder="Leave empty for no auth"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              If set, CLI must include this token to authenticate
            </p>
          </div>

          <div className="space-y-2">
            <Label>CLI Configuration</Label>
            <div className="bg-muted rounded-md p-3 font-mono text-xs relative">
              <pre className="text-muted-foreground">
{`# ~/.config/ai-pulse/cli.toml
port = ${settings.apiServerPort}
token = "${settings.apiServerToken || ''}"`}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyCliConfig}
                className="absolute top-2 right-2 h-6 px-2"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copy this to your CLI config file to connect
            </p>
          </div>

          <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              <strong>Note:</strong> The API server requires an app restart to take effect.
              Changes to port or token will apply after restarting AI Pulse.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
