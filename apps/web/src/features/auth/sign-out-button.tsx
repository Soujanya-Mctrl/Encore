"use client";

import { useRouter } from "next/navigation";
import { useEncoreAuth } from "@/providers/pollar-provider";

export function SignOutButton() {
  const { logout, loading, error } = useEncoreAuth();
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:text-white disabled:opacity-50"
        disabled={loading}
        onClick={async () => {
          if (await logout()) router.refresh();
        }}
      >
        Sign out
      </button>
      {error && <p role="alert" className="mt-1 text-sm text-amber-300">{error}</p>}
    </div>
  );
}
