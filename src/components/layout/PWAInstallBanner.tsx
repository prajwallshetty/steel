"use client";

import { useEffect, useState } from "react";
import { Download, PlusSquare, Share, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(true); // default to true to avoid flash on SSR
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default to true to avoid flash on SSR
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check if already running standalone
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;

      setIsInstalled(isStandalone);

      // Check if iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const iosDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(iosDevice);

      // Check if dismissed in this session
      const dismissed = sessionStorage.getItem("pwa_banner_dismissed") === "true";
      setIsDismissed(dismissed);

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
        toast.success("App installed successfully.");
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) return;

    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) {
      toast.info(
        "To install: Open browser menu (⋮ or Share) and select 'Add to Home screen' or 'Install App'."
      );
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success("App installed successfully.");
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("pwa_banner_dismissed", "true");
    setIsDismissed(true);
  };

  // Only display banner if NOT installed, NOT dismissed, and installable (either iOS Safari or beforeinstallprompt fired)
  const isInstallable = isIOS || deferredPrompt !== null;
  if (isInstalled || isDismissed || !isInstallable) {
    return null;
  }

  return (
    <>
      <div className="print-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 px-4 py-2.5 sm:px-8 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="hidden xs:flex size-8 rounded-lg bg-primary/10 items-center justify-center text-primary shrink-0">
            <Sparkles className="size-4 animate-pulse" />
          </div>
          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
            Install ERP for faster access and a native full-screen experience.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="xs"
            variant="default"
            onClick={handleInstallClick}
            className="h-8 text-xs font-bold gap-1 rounded-md px-3 active:scale-95 shadow-none"
          >
            <Download className="size-3.5" />
            Install
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-md px-2.5"
          >
            Later
          </Button>
        </div>
      </div>

      {/* iOS Safari Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-card text-card-foreground border rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent"
              aria-label="Close dialog"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Install ERP App</h3>
                <p className="text-xs text-muted-foreground">Install this app on your Home Screen for a faster, full-screen experience.</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="size-7 rounded-lg bg-background flex items-center justify-center font-bold border shrink-0 text-primary">
                  1
                </div>
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    Tap the Share button <Share className="size-3.5 text-primary inline" />
                  </p>
                  <p className="text-muted-foreground">Located at the bottom Safari toolbar (or top right on iPad).</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="size-7 rounded-lg bg-background flex items-center justify-center font-bold border shrink-0 text-primary">
                  2
                </div>
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    Select &quot;Add to Home Screen&quot; <PlusSquare className="size-3.5 text-primary inline" />
                  </p>
                  <p className="text-muted-foreground">Scroll down the share menu options list.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="size-7 rounded-lg bg-background flex items-center justify-center font-bold border shrink-0 text-primary">
                  3
                </div>
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground">Tap &quot;Add&quot;</p>
                  <p className="text-muted-foreground">In the top-right corner to launch as native app.</p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setShowIOSModal(false)}
              className="w-full h-11 font-semibold rounded-xl"
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
