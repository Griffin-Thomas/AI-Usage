import { useState, useCallback, useEffect } from "react";
import { Dashboard } from "@/components/Dashboard";
import { Settings } from "@/components/Settings";
import { UpdateChecker } from "@/components/UpdateChecker";
import { useUsageStore, useSettingsStore } from "@/lib/store";
import { getSettings } from "@/lib/tauri";

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { setUsage, setError } = useUsageStore();
  const { setSettings } = useSettingsStore();

  // Initialize theme on app start
  useEffect(() => {
    const initSettings = async () => {
      try {
        const settings = await getSettings();
        setSettings(settings);
        applyTheme(settings.theme);
      } catch (err) {
        console.error("Failed to load settings:", err);
        // Apply dark theme as fallback
        applyTheme("dark");
      }
    };
    initSettings();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const { settings } = useSettingsStore.getState();
      if (settings?.theme === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [setSettings]);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleCredentialsSaved = useCallback(() => {
    // Clear any existing error and usage data to trigger a fresh fetch
    setError("claude", null);
    setUsage("claude", null);
  }, [setError, setUsage]);

  return (
    <div className="h-screen w-full bg-background text-foreground">
      <UpdateChecker />
      <Dashboard
        provider="claude"
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <Settings
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
        onCredentialsSaved={handleCredentialsSaved}
      />
    </div>
  );
}

export default App;
