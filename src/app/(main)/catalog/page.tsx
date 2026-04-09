import { env } from "@/lib/env";
import { CatalogClient } from "./CatalogClient";

export const metadata = { title: "Catalog — BGMancer" };

export default function CatalogPage() {
  const requestFormEnabled = Boolean(
    env.igdbClientId && env.igdbClientSecret && env.turnstileSiteKey,
  );

  return (
    <CatalogClient
      requestFormEnabled={requestFormEnabled}
      turnstileSiteKey={env.turnstileSiteKey}
    />
  );
}
