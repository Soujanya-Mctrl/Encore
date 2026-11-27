import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudioChannel } from "@/server/onboarding-access";
import { getAuthenticatedUser } from "@/server/request-context";

export default async function ArtistStudioDashboardPage() {
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-white">Artist Studio</h1>
      <dl className="mt-5 space-y-3 rounded-xl border border-slate-800 bg-[#1B1E30] p-4 text-sm">
        <div>
          <dt className="text-slate-300">Channel</dt>
          <dd className="break-words font-semibold text-white">{channel.displayName}</dd>
        </div>
        <div>
          <dt className="text-slate-300">Handle</dt>
          <dd className="break-all text-white">@{channel.handle}</dd>
        </div>
        <div>
          <dt className="text-slate-300">Channel role</dt>
          <dd className="capitalize text-white">{channel.role}</dd>
        </div>
      </dl>
      <Link href="/discover" className="mt-5 inline-block text-sm text-[#A99BFF] underline">Back to Discover</Link>
    </main>
  );
}
