import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthLayout from "@/components/AuthLayout";
import { HeartbeatProvider } from "@/components/HeartbeatProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEDLPH",
  description: "Plataforma AEDLPH",
  applicationName: "AEDLPH",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

const inter = Inter({
  subsets: ['latin'],
  preload: false,
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased flex flex-col min-h-screen bg-surface text-text`}
      >
        <ThemeProvider>
          <HeartbeatProvider>
            <Suspense fallback={<main className="aedlph-container flex-1">{children}</main>}>
              <AuthLayout>{children}</AuthLayout>
            </Suspense>
          </HeartbeatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
