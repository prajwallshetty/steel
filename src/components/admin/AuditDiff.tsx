"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Before/after viewer for an audit entry.
 *
 * The service stores only the fields that changed, so this renders a short,
 * readable diff rather than two full records the reader has to compare by eye.
 */
export function AuditDiff({
  summary,
  oldValue,
  newValue,
}: {
  readonly summary: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}) {
  const [open, setOpen] = useState(false);

  const hasOld = isPopulated(oldValue);
  const hasNew = isPopulated(newValue);
  if (!hasOld && !hasNew) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const keys = [
    ...new Set([
      ...Object.keys((oldValue as object) ?? {}),
      ...Object.keys((newValue as object) ?? {}),
    ]),
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="View changes"
        onClick={() => setOpen(true)}
      >
        <Eye />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Changes</DialogTitle>
            <DialogDescription>{summary}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 text-left font-semibold">Field</th>
                  <th scope="col" className="py-2 text-left font-semibold">Before</th>
                  <th scope="col" className="py-2 text-left font-semibold">After</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium">{humanise(key)}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-red-700">
                      {render((oldValue as Record<string, unknown>)?.[key])}
                    </td>
                    <td className="py-2 font-mono text-xs text-emerald-700">
                      {render((newValue as Record<string, unknown>)?.[key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const isPopulated = (value: unknown): boolean =>
  value !== null &&
  typeof value === "object" &&
  Object.keys(value as object).length > 0;

const render = (value: unknown): string => {
  if (value === undefined || value === null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const humanise = (key: string): string =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
