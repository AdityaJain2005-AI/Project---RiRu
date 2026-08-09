import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Facelab — AI Skin Lab",
    template: "%s · Facelab",
  },
  description:
    "Scan your skin, track biomarkers, follow a short routine, and chat with an AI cosmetologist.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} font-sans`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
