import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/server/request-context";

export default async function ArtistStudioDashboardPage() {
  const auth = await requireAuthenticatedUser(["artist", "admin"]);
  if (auth.errorResponse) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-white">Artist Studio</h1>
      <p className="mt-2 text-sm text-slate-300">
        Signed in as <span className="font-semibold text-white">{auth.user.displayName}</span> (
        {auth.user.roles.join(", ")}).
      </p>
    </main>
  );
}
