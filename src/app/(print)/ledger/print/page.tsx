import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { formatListDate, formatMoney } from "@/lib/format/number";
import { PrintTrigger } from "@/components/receipt-payment/PrintTrigger";
import { requireUser } from "@/modules/auth/guard";
import { getCustomerLedger, getVendorLedger } from "@/modules/receipt-payment/receipt-service";
import { getSettings } from "@/modules/settings/settings-service";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const isVendor = params.partyType === "vendor";
  const name = isVendor ? "Vendor" : "Customer";
  const id = isVendor ? params.vendorId : params.customerId;
  return { title: `Print ${name} Statement - ${id?.slice(0, 6) ?? ""}` };
}

export default async function PrintLedgerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const partyType = params.partyType ?? "customer";
  const customerId = params.customerId;
  const vendorId = params.vendorId;

  if (partyType === "vendor" && !vendorId) notFound();
  if (partyType === "customer" && !customerId) notFound();

  const user = await requireUser();

  let partyName = "";
  let partyPhone = "";
  let partyEmail = "";
  let partyGst = "";
  let partyAddress = "";
  let branchId = "";

  if (partyType === "vendor") {
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, ...NOT_DELETED }
    });
    if (!vendor) notFound();
    partyName = vendor.name;
    partyPhone = vendor.phone ?? "";
    partyEmail = vendor.email ?? "";
    partyGst = vendor.gstNumber ?? "";
    partyAddress = (vendor.city || vendor.state) ? `${vendor.city ?? ""}, ${vendor.state ?? ""}`.trim() : "";
    branchId = vendor.branchId;
  } else {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, ...NOT_DELETED }
    });
    if (!customer) notFound();
    partyName = customer.name;
    partyPhone = customer.phone ?? "";
    partyEmail = customer.email ?? "";
    partyGst = customer.gstNumber ?? "";
    partyAddress = customer.address ?? "";
    branchId = customer.branchId;
  }

  const [branch, settings] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: branchId },
    }),
    getSettings(user.branchId),
  ]);

  if (!branch) notFound();

  // Enforce branch tenancy
  if (user.role !== "SUPER_ADMIN" && branchId !== user.branchId) {
    notFound();
  }

  const ledger = partyType === "vendor"
    ? await getVendorLedger(user, vendorId!, {
        from: params.from,
        to: params.to,
        branchId: user.branchId ?? undefined,
      })
    : await getCustomerLedger(user, customerId!, {
        from: params.from,
        to: params.to,
        branchId: user.branchId ?? undefined,
      });

  const grouping = settings.display.numberGrouping;
  const money = (value: number) => formatMoney(value, grouping);

  const fromDateFormatted = params.from ? formatListDate(params.from) : "Opening";
  const toDateFormatted = params.to ? formatListDate(params.to) : formatListDate(new Date().toISOString().slice(0, 10));

  const backHref = partyType === "vendor"
    ? `/ledger?vendorId=${vendorId}&partyType=vendor${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`
    : `/ledger?customerId=${customerId}&partyType=customer${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`;

  return (
    <div className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <PrintTrigger backHref={backHref} backLabel="Back to Ledger" />

      <div className="mx-auto my-6 w-full max-w-[850px] bg-white p-10 shadow-md print:my-0 print:shadow-none print:p-0">
        <div className="border border-neutral-300 p-8 rounded-md print:border-none print:p-0">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm 10mm;
              }
              body {
                background: white;
                color: black;
              }
              table {
                width: 100% !important;
                table-layout: fixed !important;
              }
              th, td {
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
                white-space: normal !important;
              }
            }
          `}} />
          
          {/* Statement Header */}
          <div className="flex justify-between items-start border-b pb-6 border-neutral-200">
            <div>
              {branch.logoUrl ? (
                <img
                  src={branch.logoUrl}
                  alt={branch.name}
                  className="h-12 w-auto object-contain mb-2"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-lg bg-black text-white font-bold select-none mb-2">
                  ST
                </div>
              )}
              <h1 className="text-lg font-black text-neutral-800 uppercase tracking-tight">
                {branch.name}
              </h1>
              {branch.address && (
                <p className="text-xs text-neutral-500 whitespace-pre-line max-w-sm mt-1">
                  {branch.address}
                </p>
              )}
              {branch.phone && <p className="text-xs text-neutral-500 mt-0.5">Phone: {branch.phone}</p>}
              {branch.email && <p className="text-xs text-neutral-500 mt-0.5">Email: {branch.email}</p>}
              {branch.gstNumber && (
                <p className="text-xs text-neutral-600 mt-1">
                  GSTIN: <span className="font-semibold">{branch.gstNumber}</span>
                </p>
              )}
            </div>

            <div className="text-right max-w-xs">
              <span className="inline-block bg-neutral-900 text-white text-xs px-3 py-1 rounded-md font-bold uppercase tracking-wider mb-3">
                STATEMENT OF ACCOUNT
              </span>
              <div className="text-xs text-neutral-700 space-y-1">
                <p className="font-bold text-neutral-900 text-sm">{partyName}</p>
                {partyPhone && <p>Phone: {partyPhone}</p>}
                {partyEmail && <p className="break-all">{partyEmail}</p>}
                {partyGst && <p className="font-mono">GSTIN: {partyGst}</p>}
                {partyAddress && <p className="text-neutral-500">{partyAddress}</p>}
              </div>
            </div>
          </div>

          {/* Period & Statement Details */}
          <div className="my-6 flex justify-between items-center text-xs border-b pb-4 border-neutral-100">
            <div>
              <span className="text-neutral-500 font-medium">Statement Period:</span>{" "}
              <span className="font-bold text-neutral-800">{fromDateFormatted}</span>{" "}
              <span className="text-neutral-400 font-light">to</span>{" "}
              <span className="font-bold text-neutral-800">{toDateFormatted}</span>
            </div>
            <div className="text-neutral-500">
              Generated On: <span className="font-mono text-neutral-800">{new Date().toLocaleString()}</span>
            </div>
          </div>

          {/* Summary Dashboard Grid */}
          <div className="grid grid-cols-4 gap-4 bg-neutral-50 border border-neutral-200 p-4 rounded-md mb-8">
            <div className="text-center border-r border-neutral-200 last:border-none">
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Opening Balance
              </p>
              <p className="text-sm font-bold text-neutral-800 mt-1 tabular-nums">
                ₹ {money(ledger.openingBalance)}
              </p>
            </div>
            <div className="text-center border-r border-neutral-200 last:border-none">
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                {partyType === "vendor" ? "Total Payments (-)" : "Total Debits (+)"}
              </p>
              <p className="text-sm font-bold text-red-600 mt-1 tabular-nums">
                ₹ {money(ledger.totalDebit)}
              </p>
            </div>
            <div className="text-center border-r border-neutral-200 last:border-none">
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                {partyType === "vendor" ? "Total Bills (+)" : "Total Credits (-)"}
              </p>
              <p className="text-sm font-bold text-emerald-700 mt-1 tabular-nums">
                ₹ {money(ledger.totalCredit)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                {partyType === "vendor" ? "Net Payable" : "Net Outstanding"}
              </p>
              <p className="text-base font-extrabold text-neutral-900 mt-1 tabular-nums">
                ₹ {money(ledger.closingBalance)}
              </p>
            </div>
          </div>

          {/* Statement Account Table */}
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-xs text-neutral-800 table-fixed">
              <thead>
                <tr className="border-b-2 border-neutral-800 bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
                  <th scope="col" className="px-3 py-3 text-left font-bold w-[12%]">Date</th>
                  <th scope="col" className="px-3 py-3 text-left font-bold w-[18%]">Voucher No</th>
                  <th scope="col" className="px-3 py-3 text-left font-bold w-[10%]">Type</th>
                  <th scope="col" className="px-3 py-3 text-left font-bold w-[30%]">Narration / Particulars</th>
                  <th scope="col" className="px-3 py-3 text-right font-bold w-[10%]">Debit (+)</th>
                  <th scope="col" className="px-3 py-3 text-right font-bold w-[10%]">Credit (-)</th>
                  <th scope="col" className="px-3 py-3 text-right font-bold w-[10%]">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {/* Render Opening Balance B/F Row */}
                <tr className="bg-neutral-50/50 font-medium italic">
                  <td className="px-3 py-2 text-neutral-400">
                    {params.from ? formatListDate(params.from) : "—"}
                  </td>
                  <td className="px-3 py-2 text-neutral-400">—</td>
                  <td className="px-3 py-2 text-neutral-400">O/B</td>
                  <td className="px-3 py-2 text-neutral-500 font-semibold">Opening Balance B/F</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {ledger.openingBalance > 0 ? money(ledger.openingBalance) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {ledger.openingBalance < 0 ? money(Math.abs(ledger.openingBalance)) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-neutral-900">
                    {money(ledger.openingBalance)}
                  </td>
                </tr>

                {ledger.rows.map((row: any) => (
                  <tr key={row.id} className="hover:bg-neutral-50/40 border-b border-neutral-100">
                    <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">
                      {formatListDate(row.date)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] font-semibold text-neutral-900 break-all whitespace-normal">
                      {row.voucherNo}
                    </td>
                    <td className="px-3 py-2 font-bold text-[10px] text-neutral-600">
                      {row.type}
                    </td>
                    <td className="px-3 py-2 text-neutral-800 font-medium break-words whitespace-normal">
                      {row.description}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-neutral-900 tabular-nums">
                      {row.debit > 0 ? money(row.debit) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-neutral-900 tabular-nums">
                      {row.credit > 0 ? money(row.credit) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-neutral-900">
                      {money(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sign-off Section */}
          <div className="mt-16 grid grid-cols-2 gap-12 pt-6 text-center text-xs text-neutral-500">
            <div className="space-y-12">
              <div className="w-full border-t border-dashed border-neutral-300" />
              <div>
                <p className="font-semibold text-neutral-800">Authorized Signatory</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">For {branch.name}</p>
              </div>
            </div>
            <div className="space-y-12">
              <div className="w-full border-t border-dashed border-neutral-300" />
              <div>
                <p className="font-semibold text-neutral-800">
                  {partyType === "vendor" ? "Vendor Acknowledgment" : "Customer Acknowledgment"}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Sign & Stamp</p>
              </div>
            </div>
          </div>

          {/* Footer disclaimer */}
          <div className="mt-12 text-center text-[9px] text-neutral-400 font-mono border-t pt-4 border-neutral-100">
            This is a computer generated document and does not require a physical signature unless requested.
            <br />
            Generated by user: {user.name} ({user.username})
          </div>

        </div>
      </div>
    </div>
  );
}
