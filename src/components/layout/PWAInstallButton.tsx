"use client";

import { useEffect, useState } from "react";
import { Check, Download, PlusSquare, Share, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PWAInstallButtonProps {
  readonly className?: string;
  readonly showLabel?: boolean;
}

export function PWAInstallButton({ className, showLabel = true }: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(true); // default to true to prevent flash on SSR
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. Check if running as standalone PWA
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;

      setIsInstalled(isStandalone);

      // 2. Check if device is iOS (Safari doesn't support beforeinstallprompt)
      const userAgent = window.navigator.userAgent.toLowerCase();
      const iosDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(iosDevice);

      // 3. Listen for native browser beforeinstallprompt (Chrome / Edge / Android)
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
        setShowIOSModal(false);
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

  // If already installed, replace with "✅ Installed" badge
  if (isInstalled) {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800/50 select-none">
        <Check className="size-4 shrink-0 text-emerald-500" />
        <span>Installed</span>
      </div>
    );
  }

  // Show only when the app is installable (either iOS or beforeinstallprompt fired)
  const isInstallable = isIOS || deferredPrompt !== null;
  if (!isInstallable) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={handleInstallClick}
        className={className || "w-full justify-start h-11 px-3.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg gap-3 flex items-center transition-all shadow-none min-h-[44px]"}
      >
        <Download className="size-4 text-primary animate-bounce" />
        {showLabel && <span>Install App</span>}
      </Button>

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
