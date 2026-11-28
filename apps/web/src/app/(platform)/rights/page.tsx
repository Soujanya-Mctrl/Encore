import Link from "next/link";
import { redirect } from "next/navigation";
import { RightsInbox } from "@/features/rights/rights-panel";
import { getAuthenticatedUser } from "@/server/request-context";

export const dynamic = "force-dynamic";

export default async function RightsWorkspacePage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return <main className="mx-auto max-w-3xl px-6 py-10 text-white">
    <Link href="/discover" className="text-violet-300">Discover</Link>
    <h1 className="mt-5 text-3xl font-semibold">Rights workspace</h1>
    <RightsInbox reviewer={user.roles.some((role) => role === "reviewer" || role === "admin")} />
  </main>;
}
