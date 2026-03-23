// BGMancer — Copyright (c) 2026 Tal Koviazin (talzerr) — MIT License
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
