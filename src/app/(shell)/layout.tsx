import { AppShell } from "@/components/layout/AppShell";

/** Chrome for every screen except the print view, which has its own layout. */
export default function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
