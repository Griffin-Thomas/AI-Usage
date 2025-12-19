import { useState, useEffect, useCallback } from "react";
import { Download, X, RefreshCw, CheckCircle } from "lucide-react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Button } from "@/components/ui/button";

type UpdateState = "idle" | "checking" | "available" | "downloading" | "ready" | "error";

interface UpdateInfo {
  version: string;
  body: string | null;
  date: string | null;
}

export function UpdateChecker() {
  const [state, setState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [updateRef, setUpdateRef] = useState<Update | null>(null);

  const checkForUpdates = useCallback(async () => {
    setState("checking");
    setError(null);

    try {
      const update = await check();
      if (update) {
        setUpdateInfo({
          version: update.version,
          body: update.body ?? null,
          date: update.date ?? null,
        });
        setUpdateRef(update);
        setState("available");
        setDismissed(false);
      } else {
        setState("idle");
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setError(err instanceof Error ? err.message : "Failed to check for updates");
      setState("error");
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!updateRef) return;

    setState("downloading");
    setDownloadProgress(0);

    try {
      let totalSize = 0;
      let downloaded = 0;

      await updateRef.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalSize = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (totalSize > 0) {
              setDownloadProgress(Math.round((downloaded / totalSize) * 100));
            }
            break;
          case "Finished":
            setDownloadProgress(100);
            break;
        }
      });

      setState("ready");
    } catch (err) {
      console.error("Failed to download update:", err);
      setError(err instanceof Error ? err.message : "Failed to download update");
      setState("error");
    }
  }, [updateRef]);

  const handleRelaunch = useCallback(async () => {
    try {
      await relaunch();
    } catch (err) {
      console.error("Failed to relaunch:", err);
      setError("Failed to restart the application");
    }
  }, []);

  // Check for updates on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000); // Wait 3 seconds after app start

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  // Don't render anything if dismissed or no update
  if (dismissed || state === "idle" || state === "checking") {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-2">
      <div className="mx-auto max-w-md">
        <div className="rounded-lg border bg-card text-card-foreground shadow-lg">
          <div className="p-3">
            {state === "available" && updateInfo && (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    Update available: v{updateInfo.version}
                  </p>
                  {updateInfo.body && (
                    <p className="text-xs text-muted-foreground truncate">
                      {updateInfo.body}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={downloadAndInstall}
                    className="h-8"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Update
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDismissed(true)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {state === "downloading" && (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">Downloading update...</p>
                  <div className="mt-1 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {downloadProgress}% complete
                  </p>
                </div>
              </div>
            )}

            {state === "ready" && (
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Update ready to install</p>
                  <p className="text-xs text-muted-foreground">
                    Restart the app to apply the update
                  </p>
                </div>
                <Button size="sm" onClick={handleRelaunch} className="h-8">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restart
                </Button>
              </div>
            )}

            {state === "error" && (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Update failed
                  </p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={checkForUpdates}
                    className="h-8"
                  >
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDismissed(true)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
