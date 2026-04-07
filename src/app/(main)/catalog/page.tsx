import { auth } from "@/lib/services/auth/auth";
import { env } from "@/lib/env";
import { Header } from "@/components/layout/Header";
import { CatalogClient } from "./CatalogClient";

export const metadata = { title: "Catalog — BGMancer" };

export default async function CatalogPage() {
  const session = await auth();

  return (
    <div className="bg-background relative min-h-screen">
      <Header user={session?.user ?? null} isDev={env.isDev} />

      {/* Main content */}
      <div className="mx-auto max-w-7xl">
        <CatalogClient />
      </div>
    </div>
  );
}
