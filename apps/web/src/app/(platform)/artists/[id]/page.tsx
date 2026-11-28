import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/server/catalog";
export const dynamic = "force-dynamic";
export default async function Artist({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const tracks = (await catalog().repo.mine(id)).filter(
    (t) => t.status === "published" && !t.paused,
  );
  if (!tracks.length) notFound();
  return (
    <main className="max-w-5xl p-8 mx-auto text-white">
      <Link href="/discover">← Discover</Link>
      <h1 className="text-3xl my-8">{tracks[0]!.artistName}</h1>
      {tracks.map((t) => (
        <Link
          className="block rounded-xl border border-slate-700 p-6 my-4"
          key={t.id}
          href={`/tracks/${t.id}`}
        >
          {t.title} · {t.genre} · {t.manifest.originCategory}
        </Link>
      ))}
    </main>
  );
}
