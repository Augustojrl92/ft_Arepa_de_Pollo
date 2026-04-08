import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthLayout from "@/components/AuthLayout";
import AchievementToastListener from "@/components/AchievementToastListener";
import { Toaster } from "sonner";
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
        <ThemeProvider>
          <Toaster richColors position="top-right" />
          <AchievementToastListener />
          <AuthLayout>{children}</AuthLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
