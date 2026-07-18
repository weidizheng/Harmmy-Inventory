import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = { title: "Harmmy Inventory", description: "Local inventory prototype" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
