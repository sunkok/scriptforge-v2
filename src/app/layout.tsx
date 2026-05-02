import type { Metadata } from "next";
import { Inter, Courier_Prime } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScriptForge v2",
  description: "Browser-based screenwriting — multi-page architecture",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${courierPrime.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--color-canvas)]">
        {children}
      </body>
    </html>
  );
}
