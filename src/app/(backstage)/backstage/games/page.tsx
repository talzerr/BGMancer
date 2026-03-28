import { Suspense } from "react";
import { GamesClient } from "./games-client";

export default function GamesPage() {
  return (
    <Suspense>
      <GamesClient />
    </Suspense>
  );
}
