import { useState, useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Dashboard } from "@/components/Dashboard";
import { Settings } from "@/components/Settings";
import { About } from "@/components/About";
import { Onboarding } from "@/components/Onboarding";
import { UpdateChecker } from "@/components/UpdateChecker";
import { useUsageStore, useSettingsStore } from "@/lib/store";
import { getSettings, hasCredentials } from "@/lib/tauri";

function applyTheme(theme: "light" | "dark" | "system" | "pink") {
  const root = document.documentElement;
  root.classList.remove("dark", "pink");
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) root.classList.add("dark");
  } else if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "pink") {
    root.classList.add("pink");
  }
}

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const { setUsage, setError } = useUsageStore();
  const { setSettings } = useSettingsStore();

  // Initialize app - check for credentials and load settings
  useEffect(() => {
    const initApp = async () => {
      try {
        // Check if credentials exist
        const hasCreds = await hasCredentials("claude");
        setShowOnboarding(!hasCreds);

        // Load settings
        const settings = await getSettings();
        setSettings(settings);
        applyTheme(settings.theme);
      } catch (err) {
        console.error("Failed to initialize app:", err);
        // Apply dark theme as fallback
        applyTheme("dark");
        // Show onboarding on error (safe default)
        setShowOnboarding(true);
      }
    };
    initApp();

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

  // Listen for tray settings event (opens settings)
  useEffect(() => {
    const unlisten = listen("tray-settings", () => {
      setIsSettingsOpen(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen for toggle-settings event (Cmd+, toggles settings)
  useEffect(() => {
    const unlisten = listen("toggle-settings", () => {
      setIsSettingsOpen((prev) => !prev);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen for show-about event
  useEffect(() => {
    const unlisten = listen("show-about", () => {
      setIsAboutOpen(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleAboutClose = useCallback(() => {
    setIsAboutOpen(false);
  }, []);

  const handleCredentialsSaved = useCallback(() => {
    // Clear any existing error and usage data to trigger a fresh fetch
    setError("claude", null);
    setUsage("claude", null);
  }, [setError, setUsage]);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    // Trigger a fresh fetch after onboarding
    setError("claude", null);
    setUsage("claude", null);
  }, [setError, setUsage]);

  // Show nothing while checking for credentials
  if (showOnboarding === null) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show onboarding for first-time users
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

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
      <About isOpen={isAboutOpen} onClose={handleAboutClose} />
    </div>
  );
}

export default App;
