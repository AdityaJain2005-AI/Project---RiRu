import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Facelab — AI Skincare Cosmetologist",
    template: "%s · Facelab",
  },
  description:
    "AI-powered skin diagnostics, personalized routines, and ingredient matching. Your personal care OS.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
