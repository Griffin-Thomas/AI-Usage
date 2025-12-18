import { useState, useEffect } from "react";
import { X, Save, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCredentials,
  saveCredentials,
  deleteCredentials,
  getSettings,
  saveSettings,
  setRefreshInterval as setSchedulerInterval,
  type Credentials,
  type AppSettings,
} from "@/lib/tauri";
import { useSettingsStore } from "@/lib/store";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialsSaved?: () => void;
}

const REFRESH_OPTIONS = [
  { value: 60, label: "1 minute" },
  { value: 180, label: "3 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
] as const;

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export function Settings({ isOpen, onClose, onCredentialsSaved }: SettingsProps) {
  const [orgId, setOrgId] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [showSessionKey, setShowSessionKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);

  // Settings state
  const { settings, setSettings } = useSettingsStore();
  const [refreshInterval, setRefreshInterval] = useState<60 | 180 | 300 | 600>(300);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [isTogglingAutostart, setIsTogglingAutostart] = useState(false);

  // Load existing credentials and settings
  useEffect(() => {
    if (isOpen) {
      loadCredentials();
      loadSettings();
    }
  }, [isOpen]);

  const loadCredentials = async () => {
    try {
      const creds = await getCredentials("claude");
      if (creds) {
        setOrgId(creds.org_id || "");
        setSessionKey(creds.session_key || "");
        setHasExisting(true);
      } else {
        setOrgId("");
        setSessionKey("");
        setHasExisting(false);
      }
    } catch (err) {
      console.error("Failed to load credentials:", err);
    }
  };

  const loadSettings = async () => {
    try {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
      setRefreshInterval(loadedSettings.refreshInterval);
      setTheme(loadedSettings.theme);

      // Check actual autostart status from system
      const autostartEnabled = await isEnabled();
      setLaunchAtStartup(autostartEnabled);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

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
    if (key === "refreshInterval") {
      setRefreshInterval(value as typeof refreshInterval);
      // Also update the scheduler's interval
      try {
        await setSchedulerInterval(value as number);
      } catch (err) {
        console.error("Failed to update scheduler interval:", err);
      }
    }
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

  const applyTheme = (newTheme: "light" | "dark" | "system") => {
    const root = document.documentElement;
    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    } else {
      root.classList.toggle("dark", newTheme === "dark");
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!orgId.trim() || !sessionKey.trim()) {
      setError("Both Organization ID and Session Key are required");
      return;
    }

    setIsSaving(true);
    try {
      const credentials: Credentials = {
        org_id: orgId.trim(),
        session_key: sessionKey.trim(),
      };
      await saveCredentials("claude", credentials);
      setSuccess("Credentials saved successfully");
      setHasExisting(true);
      onCredentialsSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setSuccess(null);
    setIsDeleting(true);

    try {
      await deleteCredentials("claude");
      setOrgId("");
      setSessionKey("");
      setHasExisting(false);
      setSuccess("Credentials deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
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
            {/* Claude Credentials */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Claude Credentials</h3>

              <div className="space-y-2">
                <Label htmlFor="org-id">Organization ID</Label>
                <Input
                  id="org-id"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your Claude.ai URL: claude.ai/settings/organization/[org-id]
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="session-key">Session Key</Label>
                <div className="relative">
                  <Input
                    id="session-key"
                    type={showSessionKey ? "text" : "password"}
                    placeholder="sk-ant-..."
                    value={sessionKey}
                    onChange={(e) => setSessionKey(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowSessionKey(!showSessionKey)}
                  >
                    {showSessionKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Find this in browser DevTools: Application → Cookies → sessionKey
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
                  {success}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Credentials"}
                </Button>
                {hasExisting && (
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

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
                  onChange={(e) =>
                    handleSettingChange(
                      "refreshInterval",
                      Number(e.target.value) as 60 | 180 | 300 | 600
                    )
                  }
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {REFRESH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <select
                  id="theme"
                  value={theme}
                  onChange={(e) =>
                    handleSettingChange(
                      "theme",
                      e.target.value as "light" | "dark" | "system"
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
            </div>

            {/* Help section */}
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-2">How to get your credentials</h3>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Log in to claude.ai in your browser</li>
                <li>Go to Settings → Organization to find your Org ID</li>
                <li>Open DevTools (F12) → Application → Cookies</li>
                <li>Copy the value of the "sessionKey" cookie</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
