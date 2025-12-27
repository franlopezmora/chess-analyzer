import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeInitializer = `
(() => {
  try {
    const storageKey = 'chess-analyzer-theme';
    const stored = localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = stored || (prefersDark ? 'dark' : 'light');
  } catch (error) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export const metadata: Metadata = {
  title: "Chess Analyzer",
  description:
    "Analizador de partidas con pipeline de evaluación y tablero interactivo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializer }}
          suppressHydrationWarning
        />
        <Providers>
          <ThemeToggle />
        {children}
        </Providers>
      </body>
    </html>
  );
}
