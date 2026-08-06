import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/database/prisma";
import { formatListDate, formatMoney } from "@/lib/format/number";
import { amountInWords } from "@/lib/format/words";
import { PrintTrigger } from "@/components/receipt-payment/PrintTrigger";
import { requireUser } from "@/modules/auth/guard";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Print Payment Voucher ${id.slice(0, 6)}` };
}

export default async function PrintPaymentPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser(); // Ensure session is active

  const payment = await prisma.cashLedgerEntry.findFirst({
    where: { id, direction: "DEBIT", deletedAt: null },
    include: {
      branch: true,
      createdBy: true,
    },
  });

  if (!payment) notFound();

  // Enforce branch tenancy: users cannot print vouchers outside their branch (except super admins)
  if (user.role !== "SUPER_ADMIN" && payment.branchId !== user.branchId) {
    notFound();
  }

  const amt = Number(payment.amount);
  const words = amountInWords(amt);

  return (
    <div className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <PrintTrigger backHref="/payments" backLabel="Back to Payments" />

      <div className="mx-auto my-6 w-full max-w-[800px] bg-white p-10 shadow-md print:my-0 print:shadow-none print:p-0">
        <div className="border border-neutral-300 p-8 rounded-md">
          {/* Header */}
          <div className="flex justify-between items-start border-b pb-6 border-neutral-200">
            <div>
              {payment.branch.logoUrl ? (
                <img
                  src={payment.branch.logoUrl}
                  alt={payment.branch.name}
                  className="h-12 w-auto object-contain mb-2"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-lg bg-black text-white font-bold select-none mb-2">
                  ST
                </div>
              )}
              <h1 className="text-xl font-extrabold text-neutral-800 uppercase">
                {payment.branch.name}
              </h1>
              {payment.branch.address && (
                <p className="text-xs text-neutral-500 whitespace-pre-line max-w-sm mt-1">
                  {payment.branch.address}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="inline-block bg-neutral-100 text-neutral-800 text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider mb-2">
                Payment Voucher
              </span>
              <p className="text-sm font-semibold text-neutral-600">
                Voucher No: <span className="font-mono text-neutral-900">{payment.reference}</span>
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Date: {formatListDate(payment.entryDate.toISOString().slice(0, 10))}
              </p>
              {payment.branch.gstNumber && (
                <p className="text-xs text-neutral-600 mt-1">
                  GSTIN: <span className="font-semibold">{payment.branch.gstNumber}</span>
                </p>
              )}
            </div>
          </div>

          {/* Details Table */}
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-3 border-b py-3 border-neutral-100 gap-4">
              <span className="text-sm text-neutral-500 font-medium">Paid To:</span>
              <span className="col-span-2 text-sm font-bold text-neutral-950">
                {payment.partyName || "—"}
              </span>
            </div>

            <div className="grid grid-cols-3 border-b py-3 border-neutral-100 gap-4">
              <span className="text-sm text-neutral-500 font-medium">Amount:</span>
              <span className="col-span-2 text-base font-extrabold text-neutral-950 tabular-nums">
                ₹ {formatMoney(amt)}
              </span>
            </div>

            <div className="grid grid-cols-3 border-b py-3 border-neutral-100 gap-4">
              <span className="text-sm text-neutral-500 font-medium">Amount in Words:</span>
              <span className="col-span-2 text-sm font-semibold text-neutral-700 italic">
                {words}
              </span>
            </div>

            <div className="grid grid-cols-3 border-b py-3 border-neutral-100 gap-4">
              <span className="text-sm text-neutral-500 font-medium">Payment Method:</span>
              <span className="col-span-2 text-sm font-medium text-neutral-900 capitalize">
                {payment.paymentMethod.replace(/_/g, " ").toLowerCase()}
                {payment.referenceNo && (
                  <span className="text-neutral-500 font-mono ml-2">({payment.referenceNo})</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 border-b py-3 border-neutral-100 gap-4">
              <span className="text-sm text-neutral-500 font-medium">Description:</span>
              <span className="col-span-2 text-sm text-neutral-800">
                {payment.particular}
              </span>
            </div>

            {payment.note && (
              <div className="grid grid-cols-3 border-b py-3 border-neutral-100 gap-4">
                <span className="text-sm text-neutral-500 font-medium">Notes:</span>
                <span className="col-span-2 text-sm text-neutral-600">
                  {payment.note}
                </span>
              </div>
            )}
          </div>

          {/* Signatures */}
          <div className="mt-20 grid grid-cols-3 gap-6 pt-6 text-center text-xs text-neutral-500">
            <div className="space-y-12">
              <div className="w-full border-t border-dashed border-neutral-300" />
              <div>
                <p className="font-semibold text-neutral-800">Authorized Signature</p>
              </div>
            </div>
            <div className="space-y-12">
              <div className="w-full border-t border-dashed border-neutral-300" />
              <div>
                <p className="font-semibold text-neutral-800">Receiver Signature</p>
              </div>
            </div>
            <div className="space-y-12">
              <div className="w-full border-t border-dashed border-neutral-300" />
              <div>
                <p className="font-semibold text-neutral-800">Prepared By</p>
                <p className="mt-0.5 font-mono">{payment.createdBy?.name || "System"}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center text-[10px] text-neutral-400 font-mono border-t pt-4 border-neutral-100">
            Generated from ERP · {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
