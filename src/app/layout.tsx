import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent & Dragons",
  description:
    "Spin up AI adventurers, gather a party, and watch them play Dungeons & Dragons with an agentic Dungeon Master.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
