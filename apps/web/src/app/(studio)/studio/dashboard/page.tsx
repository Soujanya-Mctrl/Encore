import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuthenticatedUser } from "@/server/request-context";
import { catalog } from "@/server/catalog";
export default async function Studio() {
  const auth = await requireAuthenticatedUser(["artist", "admin"]);
  if (auth.errorResponse) redirect("/login");
  let tracks;
  try {
    tracks = await catalog().repo.mine(auth.user.id);
  } catch {
    return (
      <main className="p-8 text-white">
        <h1>Artist Studio</h1>
        <p>
          Registry setup is required. Apply the Phase 2 catalog migration, then
          retry.
        </p>
      </main>
    );
  }
  return (
    <main className="max-w-5xl mx-auto p-8 text-white">
      <nav className="flex justify-between">
        <Link href="/discover">Discover</Link>
        <Link href="/studio/create" className="rounded bg-violet-600 px-5 py-3">
          Upload a release
        </Link>
      </nav>
      <h1 className="text-3xl my-8">Artist Studio</h1>
      <p>Signed in as {auth.user.displayName}</p>
      <section className="my-6 space-y-3">
        {tracks.map((t) => (
          <Link
            key={t.id}
            className="block p-5 border border-slate-700 rounded-xl"
            href={`/tracks/${t.id}`}
          >
            {t.title} · {t.status} · Passport v{t.manifest.version}
          </Link>
        ))}
        {!tracks.length && (
          <p>
            No releases yet. Upload your first MP3 to create a private Music
            Passport draft.
          </p>
        )}
      </section>
    </main>
  );
}
