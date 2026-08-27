"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { setActiveBranchCookie } from "@/modules/branches/branch-context";

export interface BranchOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

interface BranchSwitcherProps {
  readonly branches: readonly BranchOption[];
  readonly activeBranchId?: string; // undefined means "ALL"
  readonly className?: string;
}

export function BranchSwitcher({
  branches,
  activeBranchId,
  className,
}: BranchSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (branchId: string | undefined) => {
    startTransition(async () => {
      const targetValue = branchId ?? "ALL";
      await setActiveBranchCookie(targetValue);

      // Preserve existing query params, update or delete branchId
      const current = new URLSearchParams(searchParams.toString());
      if (branchId) {
        current.set("branchId", branchId);
      } else {
        current.delete("branchId");
      }

      const queryString = current.toString();
      const newPath = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newPath);
      router.refresh();
    });
  };

  const isAllActive = !activeBranchId || activeBranchId.toUpperCase() === "ALL";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 p-1 rounded-xl bg-card border shadow-xs select-none",
        isPending && "opacity-75 pointer-events-none transition-opacity",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-muted-foreground border-r pr-3 mr-1">
        <Building2 className="size-3.5 text-primary" />
        <span className="hidden md:inline">Branch Scope:</span>
      </div>

      {/* "All Branches" option */}
      <button
        type="button"
        onClick={() => handleSelect(undefined)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95",
          isAllActive
            ? "bg-primary text-primary-foreground shadow-sm font-extrabold"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
        )}
      >
        <Layers className="size-3.5" />
        All Branches
      </button>

      {/* Individual Branch options */}
      {branches.map((b) => {
        const isActive = activeBranchId === b.id;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => handleSelect(b.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm font-extrabold"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
            )}
          >
            <span className="font-mono text-[10px] opacity-75 uppercase">[{b.code}]</span>
            {b.name}
          </button>
        );
      })}
    </div>
  );
}
