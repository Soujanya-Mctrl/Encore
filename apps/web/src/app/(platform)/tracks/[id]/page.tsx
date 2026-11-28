import { notFound } from "next/navigation";
import Link from "next/link";
import { PlayPreview } from "@/features/player/player";
import { TrackRightsPanel } from "@/features/rights/rights-panel";
import { discoveryTracks } from "@/server/discovery";
import { catalog } from "@/server/catalog";
import { getAuthenticatedUser } from "@/server/request-context";
import {
  ReleaseActions,
  PassportRevision,
} from "@/features/catalog/release-actions";
import { AnchorButton } from "@/features/catalog/anchor-button";
export const dynamic = "force-dynamic";
export default async function Track({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { repo } = catalog();
  const t = await repo.get(id),
    u = await getAuthenticatedUser();
  const owner = t?.artistId === u?.id,
    reviewer =
      !!u?.roles.some((r) => ["reviewer", "admin"].includes(r)) && !owner;
  if (!t || ((t.status !== "published" || t.paused) && !owner && !reviewer))
    notFound();
  const [history, [discovered]] = await Promise.all([repo.history(id), discoveryTracks([t])]);
  return (
    <main className="max-w-4xl mx-auto p-8 text-white">
      <Link href="/discover">← Discover</Link>
      <h1 className="text-4xl mt-8">{t.title}</h1>
      <p className="my-3">
        <Link href={`/artists/${t.artistId}`}>{t.artistName}</Link> · {t.genre}
      </p>
      <p>{t.description}</p>
      <p className="my-4">
        Release: {t.status}
        {t.paused ? " · Playback suspended" : ""}
      </p>
      {t.status === "published" && <PlayPreview track={discovered!} />}
      {t.status !== "published" && (owner || reviewer) && !t.paused && (
        <audio
          controls
          preload="none"
          src={`/api/v1/tracks/${id}/play`}
          className="w-full my-6"
        />
      )}
      {owner && ["approved", "anchor_pending"].includes(t.status) && (
        <AnchorButton id={id} />
      )}
      <ReleaseActions
        id={id}
        owner={owner}
        reviewer={reviewer}
        status={t.status}
      />
      {owner && ["draft", "rejected"].includes(t.status) && (
        <PassportRevision
          id={id}
          version={t.manifest.version}
          artistName={t.artistName}
        />
      )}
      <TrackRightsPanel track={discovered!} owner={owner} reviewer={reviewer} signedIn={Boolean(u)} />
      <section className="border border-slate-700 rounded-2xl p-6 mt-8">
        <h2 className="text-2xl">
          Music Passport · Version {t.manifest.version}
        </h2>
        <dl className="grid grid-cols-2 gap-3 my-5">
          <dt>Declared origin</dt>
          <dd>{t.manifest.originCategory}</dd>
          <dt>Evidence</dt>
          <dd>{t.manifest.evidenceStatus}</dd>
          <dt>Rights declaration at anchoring</dt>
          <dd>{t.manifest.rightsStatus}</dd>
        </dl>
        {t.manifest.provenance && (
          <p className="mb-4">
            {t.manifest.provenance.outcome === "role_corroborated"
              ? "Trusted production records corroborate an AI-generated instrumental."
              : t.manifest.provenance.mode === "simulated"
                ? "Simulated provenance result."
                : t.manifest.provenance.reason === "ai_metadata_signal"
                  ? "Audio metadata contains an AI-related signal. The origin declaration is unverified."
                  : "The evidence leaves the origin declaration unverified."}
          </p>
        )}
        <p className="text-slate-400">
          A digest proves integrity of these claims. It does not prove whether
          music was made by a human or AI.
        </p>
        <p className="break-all mt-4">Manifest SHA-256: {t.manifestHash}</p>
        <p className="break-all my-3">Audio SHA-256: {t.audioHash}</p>
        <p>
          {t.anchorSignature ? (
            <a
              href={`https://explorer.solana.com/tx/${t.anchorSignature}?cluster=devnet`}
            >
              View finalized devnet commitment
            </a>
          ) : (
            "No finalized on-chain commitment yet. This release is not public."
          )}
        </p>
        <h3 className="text-xl mt-6">Immutable version history</h3>
        {history.map((h: any) => (
          <details key={h.manifest.version} className="my-3">
            <summary>
              Version {h.manifest.version} · {h.manifest_hash.slice(0, 16)}…
            </summary>
            <pre className="overflow-auto text-xs my-3">
              {JSON.stringify(h.manifest, null, 2)}
            </pre>
          </details>
        ))}
      </section>
    </main>
  );
}
