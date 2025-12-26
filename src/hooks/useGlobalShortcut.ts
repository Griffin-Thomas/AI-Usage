import { useEffect, useRef } from "react";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useGlobalShortcut(shortcut: string | null) {
  const currentShortcutRef = useRef<string | null>(null);

  useEffect(() => {
    const setupShortcut = async () => {
      // Unregister previous shortcut if exists
      if (currentShortcutRef.current) {
        try {
          const wasRegistered = await isRegistered(currentShortcutRef.current);
          if (wasRegistered) {
            await unregister(currentShortcutRef.current);
          }
        } catch (e) {
          console.warn("Failed to unregister previous shortcut:", e);
        }
        currentShortcutRef.current = null;
      }

      // Register new shortcut if provided
      if (shortcut) {
        try {
          await register(shortcut, async (event) => {
            if (event.state === "Pressed") {
              const window = getCurrentWindow();
              const isVisible = await window.isVisible();
              if (isVisible) {
                await window.hide();
              } else {
                await window.show();
                await window.setFocus();
              }
            }
          });
          currentShortcutRef.current = shortcut;
        } catch (e) {
          console.error("Failed to register global shortcut:", e);
        }
      }
    };

    setupShortcut();

    // Cleanup on unmount
    return () => {
      if (currentShortcutRef.current) {
        unregister(currentShortcutRef.current).catch((e) => {
          console.warn("Failed to unregister shortcut on cleanup:", e);
        });
      }
    };
  }, [shortcut]);
}
