import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "@/styles/sheet.css";

export const metadata: Metadata = {
  title: {
    default: "Steel Quotation ERP",
    template: "%s · Steel Quotation ERP",
  },
  description:
    "Role-based, multi-branch ERP for steel trading — Excel-faithful quotations, cash ledger, approvals and reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-muted/30 text-foreground">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
