import Link from "next/link";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { getAuthenticatedUser } from "@/server/request-context";
import { catalog } from "@/server/catalog";
import { CatalogQuerySchema, ORIGIN_CATEGORIES } from "@encore/contracts";
export const dynamic = "force-dynamic";
export default async function Discover({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const raw = await searchParams;
  const parsed = CatalogQuerySchema.safeParse(
    Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== "")),
  );
  const query = parsed.success ? parsed.data : { q: "", page: 1 };
  let result;
  let failed = false;
  try {
    result = await catalog().repo.search(query);
  } catch {
    failed = true;
  }
  const user = await getAuthenticatedUser();
  const artist = user?.roles.includes("artist");
  const href = !user ? "/login" : artist ? "/studio/dashboard" : "/onboarding?journey=artist";
  const label = !user ? "Sign In / Connect" : artist ? "Open Artist Studio" : "Enable Artist Studio";
  return (
    <main className="max-w-6xl mx-auto px-6 py-12 text-white">
      <nav className="flex justify-between">
        <Link href="/">ENCORE</Link>
        <div className="flex flex-wrap items-center gap-4">
          <Link href={href}>{label}</Link>
          {user && <SignOutButton />}
        </div>
      </nav>
      <h1 className="text-4xl mt-12">Discover Music</h1>
      <p className="text-slate-400 my-4">
        Explore every creative origin. Read the Passport. Choose who you
        support.
      </p>
      <form className="flex flex-wrap gap-3 my-8">
        <input
          aria-label="Search tracks"
          name="q"
          defaultValue={query.q}
          placeholder="Title, artist, genre…"
          className="bg-slate-800 rounded p-3 flex-1"
        />
        <select
          aria-label="Creative origin"
          name="origin"
          defaultValue={query.origin ?? ""}
          className="bg-slate-800 rounded p-3"
        >
          <option value="">All creative origins</option>
          {ORIGIN_CATEGORIES.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <input
          aria-label="Genre"
          name="genre"
          defaultValue={query.genre}
          placeholder="Genre"
          className="bg-slate-800 rounded p-3"
        />
        <button className="rounded bg-violet-600 px-6">Search</button>
      </form>
      {failed ? (
        <p role="alert">
          Catalog is temporarily unavailable. Please try again.
        </p>
      ) : (
        <>
          <p aria-live="polite">{result?.total ?? 0} tracks</p>
          <section className="grid md:grid-cols-3 gap-5 my-6">
            {result?.tracks.map((t) => (
              <article
                key={t.id}
                className="rounded-2xl border border-slate-700 p-6"
              >
                <p className="text-violet-300 text-sm">
                  {t.manifest.originCategory.replaceAll("_", " ")}
                </p>
                <h2 className="text-xl my-3">
                  <Link href={`/tracks/${t.id}`}>{t.title}</Link>
                </h2>
                <p>
                  {t.artistName} · {t.genre}
                </p>
                <p className="text-slate-400 text-sm my-3">
                  {t.manifest.evidenceStatus} · {t.manifest.rightsStatus}
                </p>
                <Link href={`/tracks/${t.id}`} className="text-violet-300">
                  Listen & view Music Passport →
                </Link>
              </article>
            ))}
          </section>
          {result?.total === 0 && (
            <p>No published tracks match these filters. Try another search.</p>
          )}
          <div className="flex gap-6">
            {query.page > 1 && (
              <Link
                href={`?${new URLSearchParams({ ...raw, page: String(query.page - 1) })}`}
              >
                Previous
              </Link>
            )}
            {(result?.total ?? 0) > query.page * 12 && (
              <Link
                href={`?${new URLSearchParams({ ...raw, page: String(query.page + 1) })}`}
              >
                Next
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}
