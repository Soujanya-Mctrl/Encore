import { catalog } from "@/server/catalog";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listReviewAssignments } from "@/server/onboarding-access";
import { getAuthenticatedUser } from "@/server/request-context";

export default async function AdminReviewsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  if (!user.roles.some((role) => role === "reviewer" || role === "admin")) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold text-white">Reviewer access required</h1>
        <p className="mt-2 text-sm text-slate-300">Only assigned reviewers can open the review queue.</p>
        <Link href="/discover" className="mt-5 inline-block text-sm text-[#A99BFF] underline">Back to Discover</Link>
      </main>
    );
  }

  const assignments = await listReviewAssignments(user.id);
  const tracks = (await catalog().repo.pending()).filter((track) => track.artistId !== user.id);
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-white">Your review assignments</h1>
      {assignments.length === 0 ? (
        <p className="mt-2 text-sm text-slate-300">You have no pending assignments.</p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-[#1B1E30] text-sm">
          {assignments.map((assignment) => (
            <li key={assignment.id} className="p-4">
              <p className="break-all font-semibold text-white">Assignment {assignment.id}</p>
              <p className="mt-1 break-all text-slate-300">Channel {assignment.channelId}</p>
            </li>
          ))}
        </ul>
      )}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-white">Release review queue</h2>
        <p className="mt-2 text-slate-300">Review contributor consent, preview permission and declared origin.</p>
        {tracks.map((track) => (
          <Link
            className="my-4 block rounded-xl border border-slate-700 p-5"
            href={`/tracks/${track.id}`}
            key={track.id}
          >
            {track.title} · {track.artistName} · {track.manifest.originCategory}
          </Link>
        ))}
        {tracks.length === 0 && <p>No releases awaiting review.</p>}
      </section>
      <Link href="/discover" className="mt-5 inline-block text-sm text-[#A99BFF] underline">Back to Discover</Link>
    </main>
  );
}
