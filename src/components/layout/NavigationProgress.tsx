"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Instant top navigation progress bar.
 * Gives immediate visual feedback (<30ms) when navigation starts.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    // When pathname or searchParams change, the navigation has completed.
    setNavigating(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      const target = event.currentTarget as HTMLAnchorElement | null;
      if (!target) return;
      const href = target.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("#") &&
        target.target !== "_blank" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        if (href !== window.location.pathname) {
          setNavigating(true);
        }
      }
    };

    const anchors = document.querySelectorAll("a[href^='/']");
    anchors.forEach((a) => {
      a.addEventListener("click", handleAnchorClick as EventListener);
    });

    return () => {
      anchors.forEach((a) => {
        a.removeEventListener("click", handleAnchorClick as EventListener);
      });
    };
  }, [pathname]);

  if (!navigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent pointer-events-none">
      <div className="h-full bg-primary animate-nav-progress shadow-sm shadow-primary/50" />
    </div>
  );
}
