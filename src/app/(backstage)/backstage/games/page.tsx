import { Suspense } from "react";
import { GamesClient } from "./GamesClient";

export default function GamesPage() {
  return (
    <Suspense>
      <GamesClient />
    </Suspense>
  );
}
