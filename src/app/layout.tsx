import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Mono } from "next/font/google";

import { AppContextProvider } from "@/components/patterns/AppContextProvider";
import { ThemeProvider } from "@/components/patterns/ThemeProvider";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KavShare - Premium SaaS & Procurement",
  description: "Dynamic procurement sharing and provider marketplace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ThemeProvider>
        <AppContextProvider>
          <html
            lang="en"
            className={`${inter.variable} ${spaceMono.variable} ${jetbrainsMono.variable} h-full antialiased`}
          >
            <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
              {/* Global analytics telemetry node */}
              <div
                id="analytics-telemetry"
                data-app="kavshare"
                className="hidden"
              />
              {children}
            </body>
          </html>
        </AppContextProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}
