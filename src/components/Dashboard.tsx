import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";
import { RefreshCw, Settings, BarChart3, Activity, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UsageCard, UsageCardSkeleton } from "@/components/UsageCard";
import { Analytics } from "@/components/Analytics";
import { SessionBanner } from "@/components/SessionBanner";
import { Confetti } from "@/components/Confetti";
import { useUsageStore, useAccountsStore } from "@/lib/store";
import { useUsage } from "@/hooks/useUsage";
import { formatUsageForClipboard, copyToClipboard } from "@/lib/utils";
import type { ProviderId } from "@/lib/types";

const PROVIDER_URLS: Record<ProviderId, string> = {
  claude: "https://claude.ai",
  chatgpt: "https://chat.openai.com",
  gemini: "https://gemini.google.com",
};

const PROVIDER_NAMES: Record<ProviderId, string> = {
  claude: "Claude.ai",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
};

type TabType = "usage" | "analytics";

interface DashboardProps {
  provider?: ProviderId;
  onSettingsClick?: () => void;
}

export function Dashboard({ provider = "claude", onSettingsClick }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("usage");
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { usage, isLoading, error, lastRefresh, getAllUsage } = useUsageStore();
  const { accounts } = useAccountsStore();
  const { forceRefresh } = useUsage();

  // Get all usage data for display
  const allUsage = getAllUsage();
  const hasMultipleAccounts = accounts.length > 1;

  // Check if any account is loading
  const anyLoading = Object.values(isLoading).some(Boolean);

  // Get the first error for display in the banner
  const firstError = Object.entries(error).find(([, err]) => err !== null)?.[1] ?? null;

  // Get the most recent last refresh time
  const mostRecentRefresh = Object.values(lastRefresh)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const handleCopyUsage = async () => {
    if (allUsage.length === 0) return;

    // Format all usage data
    const text = allUsage
      .map((u) => {
        const prefix = hasMultipleAccounts ? `[${u.accountName}] ` : "";
        return prefix + formatUsageForClipboard(u);
      })
      .join("\n\n");

    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenProvider = useCallback(async () => {
    try {
      await open(PROVIDER_URLS[provider]);
    } catch (err) {
      console.error(`Failed to open ${PROVIDER_NAMES[provider]}:`, err);
    }
  }, [provider]);

  // Listen for menu events from native app menu (macOS)
  useEffect(() => {
    const unlistenUsage = listen("menu-usage", () => {
      setActiveTab("usage");
    });
    const unlistenAnalytics = listen("menu-analytics", () => {
      setActiveTab("analytics");
    });
    return () => {
      unlistenUsage.then((fn) => fn());
      unlistenAnalytics.then((fn) => fn());
    };
  }, []);

  // Listen for usage reset events to show confetti
  useEffect(() => {
    const unlisten = listen("usage-reset", () => {
      setShowConfetti(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Group usage by account for display
  const groupedUsage = accounts.map((account) => ({
    account,
    usage: usage[account.id] ?? null,
    isLoading: isLoading[account.id] ?? false,
    error: error[account.id] ?? null,
    lastRefresh: lastRefresh[account.id] ?? null,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Confetti animation on usage reset */}
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-lg font-semibold">AI Pulse</h1>
        <div className="flex items-center gap-2">
          {activeTab === "usage" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyUsage}
                disabled={allUsage.length === 0}
                title="Copy usage to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={forceRefresh}
                disabled={anyLoading}
                title="Refresh usage"
              >
                <RefreshCw className={`h-4 w-4 ${anyLoading ? "animate-spin" : ""}`} />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={onSettingsClick} title="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "usage"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("usage")}
        >
          <Activity className="h-4 w-4" />
          Current Usage
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "analytics"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("analytics")}
        >
          <BarChart3 className="h-4 w-4" />
          Analytics
        </button>
      </div>

      {/* Session Banner (shows when there are credential/session issues) */}
      <SessionBanner
        error={firstError}
        onSettingsClick={onSettingsClick ?? (() => {})}
        onRefresh={forceRefresh}
      />

      {/* Content */}
      {activeTab === "usage" ? (
        <>
          <main className="flex-1 overflow-auto p-4">
            {/* Loading state when no data yet */}
            {anyLoading && allUsage.length === 0 && (
              <div className="grid gap-4">
                <UsageCardSkeleton />
                <UsageCardSkeleton />
              </div>
            )}

            {/* Multi-account display */}
            {groupedUsage.length > 0 ? (
              <div className="space-y-6">
                {groupedUsage.map(({ account, usage: accountUsage, isLoading: accountLoading }) => (
                  <div key={account.id}>
                    {/* Account header - only show when multiple accounts */}
                    {hasMultipleAccounts && (
                      <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        {account.name}
                      </h2>
                    )}

                    {/* Loading skeleton for this account */}
                    {accountLoading && !accountUsage && (
                      <div className="grid gap-4">
                        <UsageCardSkeleton />
                        <UsageCardSkeleton />
                      </div>
                    )}

                    {/* Usage cards for this account */}
                    {accountUsage && (
                      <div className="grid gap-4">
                        {accountUsage.limits.map((limit) => (
                          <UsageCard
                            key={`${account.id}-${limit.id}`}
                            limit={limit}
                            onRefresh={forceRefresh}
                            onOpenProvider={handleOpenProvider}
                            providerName={PROVIDER_NAMES[provider]}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              !anyLoading && (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <p>No usage data available</p>
                  <p className="text-sm">Configure your credentials in Settings</p>
                </div>
              )
            )}
          </main>

          {/* Footer */}
          <footer className="p-2 border-t text-xs text-center text-muted-foreground">
            {mostRecentRefresh ? (
              <span>Last updated: {mostRecentRefresh.toLocaleTimeString()}</span>
            ) : (
              <span>Not yet refreshed</span>
            )}
          </footer>
        </>
      ) : (
        <div className="flex-1 overflow-hidden">
          <Analytics provider={provider} />
        </div>
      )}
    </div>
  );
}
