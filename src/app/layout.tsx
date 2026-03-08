import type { Metadata } from "next";
import "./globals.css";
import { PlayerProvider } from "@/context/player-context";

export const metadata: Metadata = {
  title: "BGMancer — AI Video Game OST Curator",
  description:
    "Add games you've played. BGMancer uses AI to find the best official soundtracks on YouTube and syncs them into your personal playlist.",
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <PlayerProvider>{children}</PlayerProvider>
      </body>
    </html>
  );
}
