import { auth } from "@/lib/services/auth/auth";
import { env } from "@/lib/env";
import { CatalogClient } from "./CatalogClient";

export const metadata = { title: "Catalog — BGMancer" };

export default async function CatalogPage() {
  const session = await auth();
  const requestFormEnabled = Boolean(
    env.igdbClientId && env.igdbClientSecret && env.turnstileSiteKey,
  );

  return (
    <CatalogClient
      requestFormEnabled={requestFormEnabled}
      turnstileSiteKey={env.turnstileSiteKey}
      userName={session?.user?.email?.split("@")[0] ?? null}
    />
  );
}
