import { NextResponse, type NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import { getSessionUser } from "@/modules/auth/session";
import { hasAnyPermission, PERMISSIONS } from "@/modules/permissions/permissions";
import { recordAudit } from "@/modules/audit/audit-service";
import {
  buildReport,
  toCsv,
  type ReportKind,
} from "@/modules/reports/report-service";
import { getSettings } from "@/modules/settings/settings-service";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPdfDocument } from "@/lib/pdf/ReportPdfDocument";
import { createElement } from "react";

/**
 * Report export (CSV or PDF).
 *
 * A route handler rather than a server action, because the response is a file
 * download. It re-authorises from the session and builds the report through the
 * same scoped service the screen uses — an export can never widen what the
 * caller is allowed to see.
 */

const KINDS: readonly ReportKind[] = [
  "quotations",
  "customers",
  "ledger",
  "gst",
  "manager-performance",
  "branch-performance",
];

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_VIEW_ALL,
      PERMISSIONS.REPORT_VIEW_BRANCH,
      PERMISSIONS.REPORT_VIEW_OWN,
    ])
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const kind = params.get("kind") as ReportKind | null;
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  }

  const format = params.get("format") ?? "csv";

  const filters = {
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    branchId: params.get("branchId") ?? undefined,
    status: params.get("status") ?? undefined,
  };

  const report = await buildReport(user, kind, filters);

  await recordAudit({
    action: AuditAction.EXPORT,
    entity: "Report",
    entityId: kind,
    summary: `Exported ${report.title} (${report.rows.length} rows) as ${format.toUpperCase()}`,
    userId: user.id,
    branchId: user.branchId,
    newValue: filters,
  });

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const settings = await getSettings(user.branchId);
    const grouping = settings.display.numberGrouping;
    
    // Render report to PDF buffer
    const doc = createElement(ReportPdfDocument, { report, grouping }) as any;
    const buffer = await renderToBuffer(doc);
    const filename = `${kind}-${stamp}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const filename = `${kind}-${stamp}.csv`;

  return new NextResponse(toCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // A report is a point-in-time extract; caching it would serve stale
      // figures and, on a shared proxy, another user's scope.
      "Cache-Control": "no-store",
    },
  });
}
