import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Venture Wolf",
  description: "Credit-gated AI founder screening for Venture Wolf.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
