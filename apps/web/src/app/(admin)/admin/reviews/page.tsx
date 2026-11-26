import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/server/request-context";

export default async function AdminReviewsPage() {
  const auth = await requireAuthenticatedUser(["reviewer", "admin"]);
  if (auth.errorResponse) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-white">Reviewer Queue</h1>
      <p className="mt-2 text-sm text-slate-300">
        Authorized reviewer: <span className="font-semibold text-white">{auth.user.displayName}</span>
      </p>
    </main>
  );
}
