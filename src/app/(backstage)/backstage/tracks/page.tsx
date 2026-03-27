import { Suspense } from "react";
import { TrackLabClient } from "./track-lab-client";

export default function TrackLabPage() {
  return (
    <Suspense>
      <TrackLabClient />
    </Suspense>
  );
}
