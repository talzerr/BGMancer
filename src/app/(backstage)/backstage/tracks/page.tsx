import { Suspense } from "react";
import { TrackLabClient } from "./TrackLabClient";

export default function TrackLabPage() {
  return (
    <Suspense>
      <TrackLabClient />
    </Suspense>
  );
}
