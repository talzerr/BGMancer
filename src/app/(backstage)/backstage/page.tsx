import { redirect } from "next/navigation";

export default function BackstageRootPage() {
  redirect("/backstage/games");
}
