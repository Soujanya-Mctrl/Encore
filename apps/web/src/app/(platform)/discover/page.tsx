import Link from "next/link";

export default function DiscoverPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Discover Music</h1>
          <p className="mt-1 text-sm text-slate-300">
            Public provenance-aware catalog — no authentication required to browse.
          </p>
        </div>
        <Link
          href="/login"
          className="rounded-xl bg-[#6954CF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B46C0]"
        >
          Sign In / Connect
        </Link>
      </div>
    </main>
  );
}
