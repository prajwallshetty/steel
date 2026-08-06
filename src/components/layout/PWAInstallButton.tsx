"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        setIsInstalled(true);
      }

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
        toast.success("App installed successfully!");
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
    if (!deferredPrompt) {
      if (isInstalled) {
        toast.info("App is already installed!");
      } else {
        toast.info(
          "Installation helper: Click the browser menu (three dots / share icon) and select 'Add to Home screen' or 'Install App'.",
          { duration: 5000 }
        );
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success("App installation started!");
    }
    setDeferredPrompt(null);
  };

  return (
    <Button
      variant="ghost"
      onClick={handleInstallClick}
      className="w-full justify-start h-10 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded-md gap-3 flex items-center transition-all shadow-none"
    >
      <Download className="size-4 text-muted-foreground" />
      <span>Download App</span>
    </Button>
  );
}
