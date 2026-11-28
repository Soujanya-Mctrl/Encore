import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/server/request-context";
import { catalog } from "@/server/catalog";
export default async function Reviews() {
  const auth = await requireAuthenticatedUser(["reviewer", "admin"]);
  if (auth.errorResponse) redirect("/login");
  const tracks = await catalog().repo.pending();
  return (
    <main className="max-w-5xl mx-auto p-8 text-white">
      <h1 className="text-3xl mb-6">Review queue</h1>
      <p className="text-slate-400">
        Review contributor consent, preview permissions and declared origin.
        Approval does not automatically corroborate evidence.
      </p>
      {tracks
        .filter((t) => t.artistId !== auth.user.id)
        .map((t) => (
          <Link
            className="block border border-slate-700 p-5 my-4 rounded-xl"
            href={`/tracks/${t.id}`}
            key={t.id}
          >
            {t.title} · {t.artistName} · {t.manifest.originCategory}
          </Link>
        ))}
      {!tracks.length && <p>No releases awaiting review.</p>}
    </main>
  );
}
