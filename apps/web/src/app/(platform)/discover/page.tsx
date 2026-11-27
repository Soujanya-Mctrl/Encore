import Link from "next/link";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { getAuthenticatedUser } from "@/server/request-context";

export default async function DiscoverPage() {
  const user = await getAuthenticatedUser();
  const artist = user?.roles.includes("artist");
  const href = !user ? "/login" : artist ? "/studio/dashboard" : "/onboarding?journey=artist";
  const label = !user ? "Sign In / Connect" : artist ? "Open Artist Studio" : "Enable Artist Studio";
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Discover Music</h1>
          <p className="mt-1 text-sm text-slate-300">
            Public provenance-aware catalog — no authentication required to browse.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Link
          href={href}
          className="rounded-xl bg-[#6954CF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B46C0]"
        >
          {label}
        </Link>
        {user && <SignOutButton />}
        </div>
      </div>
    </main>
  );
}
