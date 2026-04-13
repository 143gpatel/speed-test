import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internet Speed Test Premium",
  description: "Premium internet speed checker with history and live graph"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
