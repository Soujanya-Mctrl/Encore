import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <span className="inline-block rounded-full bg-[#6954CF]/20 px-3 py-1 text-xs font-medium text-[#A99BFF]">
        Solana Devnet MVP
      </span>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">ENCORE</h1>
      <p className="mt-4 max-w-2xl text-slate-300">
        Know what you listen to. Choose who you support. Give every legitimate creator a fair path
        to earn.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/discover"
          className="rounded-xl bg-[#168579] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#137268]"
        >
          Explore Discover
        </Link>
        <Link
          href="/login"
          className="rounded-xl bg-[#6954CF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5B46C0]"
        >
          Sign In / Onboard
        </Link>
        <Link
          href="/studio/dashboard"
          className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          Artist Studio
        </Link>
      </div>
    </main>
  );
}
