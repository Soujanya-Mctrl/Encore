import { NextResponse } from "next/server";
import { getServerContainer } from "@/server/container";

export async function GET(
  _req: Request,
  context: { params: Promise<{ sig: string }> }
) {
  const { sig } = await context.params;
  const { marketplace, cluster } = getServerContainer();
  const receipt = await marketplace.getReceiptBySignature(sig);
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  return NextResponse.json({
    cluster,
    explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`,
    receipt
  });
}
