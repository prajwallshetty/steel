import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "@/styles/sheet.css";

export const metadata: Metadata = {
  title: {
    default: "Steel Quotation System",
    template: "%s · Steel Quotation System",
  },
  description:
    "Discount/CD quotation system for steel trading — Excel-faithful sheets, live pricing and vector PDF output.",
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
