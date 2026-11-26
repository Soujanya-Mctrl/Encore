import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "encore-web",
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet"
  });
}
