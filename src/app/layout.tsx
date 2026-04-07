// BGMancer — Copyright (c) 2026 Tal Koviazin (talzerr) — MIT License
import "./globals.css";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

// Main app uses 400/500 only per DESIGN_SYSTEM.md; 600 is loaded for backstage,
// which is exempt from main-app design rules.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark", "font-sans", inter.variable, jakarta.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
