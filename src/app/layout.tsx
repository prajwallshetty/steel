import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "@/styles/sheet.css";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Steel Quotation ERP",
    template: "%s · Steel Quotation ERP",
  },
  description:
    "Role-based, multi-branch ERP for steel trading — Excel-faithful quotations, cash ledger, approvals and reporting.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sansFont.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted/30 text-foreground">
        {children}
        <Toaster position="top-right" richColors />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            if (document.readyState === 'complete') {
              navigator.serviceWorker.register('/sw.js');
            } else {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          }
        `}} />
      </body>
    </html>
  );
}
