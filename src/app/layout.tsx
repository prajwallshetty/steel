import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PWAProvider } from "@/components/layout/PWAProvider";
import "./globals.css";
import "@/styles/sheet.css";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Quotation ERP",
    template: "%s · Quotation ERP",
  },
  description:
    "Role-based, multi-branch ERP for alloys trading — Excel-faithful quotations, cash ledger, approvals and reporting.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ERP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sansFont.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted/30 text-foreground">
        <PWAProvider>
          {children}
          <Toaster position="top-right" richColors />
        </PWAProvider>
      </body>
    </html>
  );
}
