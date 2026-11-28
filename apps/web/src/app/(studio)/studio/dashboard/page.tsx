import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUser } from "@/server/request-context";
import { getStudioChannel } from "@/server/onboarding-access";
import { catalog } from "@/server/catalog";
export default async function Studio() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.onboardingStatus !== "completed") redirect("/onboarding?journey=artist");

  const channel = await getStudioChannel(user.id);
  if (!channel) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold text-white">Artist Studio</h1>
        <p className="mt-2 text-sm text-slate-300">You don’t have access to an active artist channel.</p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link href="/onboarding?journey=artist" className="text-[#A99BFF] underline">Set up Artist Studio</Link>
          <Link href="/discover" className="text-[#A99BFF] underline">Back to Discover</Link>
        </div>
      </main>
    );
  }

  let tracks;
  try {
    tracks = await catalog().repo.mine(user.id);
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
      <p>Signed in as {user.displayName}</p>
      <p>{channel.displayName} · @{channel.handle} · {channel.role}</p>
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
