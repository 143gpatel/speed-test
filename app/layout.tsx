import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internet Speed Test Premium",
  description: "Premium internet speed checker with live graph and adaptive tests"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
