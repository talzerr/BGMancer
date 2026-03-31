// BGMancer — Copyright (c) 2026 Tal Koviazin (talzerr) — MIT License
import "./globals.css";
import { Geist, Bricolage_Grotesque } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700", "800"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable, bricolage.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
