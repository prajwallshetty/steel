"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * CSV or PDF download.
 *
 * Fetched rather than linked so a failure (an expired session, a permission
 * change since the page loaded) surfaces as a toast instead of navigating the
 * user to a JSON error body.
 */
export function ExportButton({
  href,
  label = "Export CSV",
}: {
  readonly href: string;
  readonly label?: string;
}) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    let url: string | null = null;
    try {
      const response = await fetch(href);
      if (!response.ok) {
        const message =
          response.status === 401
            ? "Your session has expired. Sign in again."
            : response.status === 403
              ? "You do not have permission to export."
              : "The export could not be generated.";
        toast.error("Export failed", { description: message });
        return;
      }

      const blob = await response.blob();
      const filename =
        response.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ??
        (href.includes("format=pdf") ? "report.pdf" : "report.csv");

      url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed", { description: "Check your connection." });
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
    }
  };

  return (
    <Button onClick={download} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      {label}
    </Button>
  );
}
