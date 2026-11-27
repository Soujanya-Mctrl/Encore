import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Social and email sign-in are unavailable. Sign in with a Solana wallet." },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
