import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthLayout from "@/components/AuthLayout";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEDLPH",
  description: "Plataforma AEDLPH",
  applicationName: "AEDLPH",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

const inter = Inter({
  subsets: ['latin'],
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
          <ServiceWorkerRegistration />
          <Suspense fallback={<main className="aedlph-container flex-1">{children}</main>}>
            <AuthLayout>{children}</AuthLayout>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
