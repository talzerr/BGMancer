import { Suspense } from "react";
import { RequestsClient } from "./RequestsClient";

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestsClient />
    </Suspense>
  );
}
