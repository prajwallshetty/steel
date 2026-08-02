import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeadingProps {
  readonly title: string;
  readonly description?: string;
  readonly backHref?: string;
  readonly backLabel?: string;
  readonly actions?: React.ReactNode;
}

export function PageHeading({
  title,
  description,
  backHref,
  backLabel = "Back",
  actions,
}: PageHeadingProps) {
  return (
    <div className="space-y-6 mb-12">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-base text-muted-foreground transition-colors hover:text-black font-medium"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-[45px] font-bold tracking-tight text-black leading-tight">{title}</h1>
          {description && (
            <p className="max-w-3xl text-[17px] md:text-[18px] text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
