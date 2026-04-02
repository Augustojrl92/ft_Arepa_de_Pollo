import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthLayout from "@/components/AuthLayout";
import MswProvider from "@/components/MswProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEDLPH",
  description: "Plataforma AEDLPH",
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
        <MswProvider>
          <ThemeProvider>
            <Suspense fallback={null}>
              <AuthLayout>{children}</AuthLayout>
            </Suspense>
          </ThemeProvider>
        </MswProvider>
      </body>
    </html>
  );
}
