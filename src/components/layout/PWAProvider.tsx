"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

export function PWAProvider({ children }: { readonly children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let refreshing = false;

    // Handle controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");

        // Check if there is a waiting worker ready to update
        const promptUpdate = (waitingWorker: ServiceWorker) => {
          toast.custom(
            (t) => (
              <div className="flex flex-col gap-3 p-4 bg-card text-card-foreground border rounded-xl shadow-lg border-primary/30 w-full max-w-sm">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <RefreshCw className="size-5 animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">New Version Available</p>
                    <p className="text-xs text-muted-foreground">An update to LSC Alloys ERP is ready.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => toast.dismiss(t)}
                    className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
                  >
                    Later
                  </button>
                  <button
                    onClick={() => {
                      toast.dismiss(t);
                      waitingWorker.postMessage({ type: "SKIP_WAITING" });
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-xs"
                  >
                    Update Now
                  </button>
                </div>
              </div>
            ),
            { duration: Infinity, id: "pwa-update-toast" }
          );
        };

        if (reg.waiting) {
          promptUpdate(reg.waiting);
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                promptUpdate(newWorker);
              }
            });
          }
        });
      } catch (err) {
        console.error("SW registration error:", err);
      }
    };

    registerSW();

    // Monitor Online / Offline status
    const handleOffline = () => {
      toast("You are currently offline", {
        description: "Static pages remain accessible from cache.",
        icon: <WifiOff className="size-4 text-amber-500" />,
        duration: 5000,
        id: "offline-toast",
      });
    };

    const handleOnline = () => {
      toast("Connection restored", {
        description: "You are back online.",
        icon: <Wifi className="size-4 text-emerald-500" />,
        duration: 4000,
        id: "online-toast",
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return <>{children}</>;
}
