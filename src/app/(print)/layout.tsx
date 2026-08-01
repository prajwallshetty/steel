/**
 * Bare layout for the print view — no sidebar, no navbar, no chrome of any
 * kind, so what the browser paints is exactly what the paper receives.
 *
 * The `print-root` class, not a `min-h-screen` utility, sets the full-height
 * background: a `100vh` minimum survives into print media, where it resolves
 * against the viewport rather than the page box and spills a blank second sheet
 * out of the printer.
 */
export default function PrintLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="print-root">{children}</div>;
}
