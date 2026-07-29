import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "ClearFabric - The Shatnez Lab | מעבדת שעטנז מקצועית ב-Spring Valley, NY",
  description: "Professional shatnez testing and inspection services in Spring Valley, NY. ClearFabric - מעבדת שעטנז מקצועית ומוסמכת. VIP home visits available.",
};

import { LanguageProvider } from "@/lib/LanguageContext";
import { LiveChatWidget } from "@/components/LiveChatWidget";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col font-sans">
        <LanguageProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <LiveChatWidget />
          <Analytics />
        </LanguageProvider>
      </body>
    </html>
  );
}

