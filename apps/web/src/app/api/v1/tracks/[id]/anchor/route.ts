import { NextResponse } from "next/server";
import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { requireAuthenticatedUser } from "@/server/request-context";
import { getServerContainer } from "@/server/container";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { SolanaRegistry } from "@encore/infrastructure";
import { CatalogError } from "@encore/core";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rejected = guardSessionAuthWrite(req);
  if (rejected) return rejected;
  const auth = await requireAuthenticatedUser(["artist"], req);
  if (auth.errorResponse) return auth.errorResponse;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.address !== "string")
    return NextResponse.json(
      { error: "Linked wallet address required" },
      { status: 400 },
    );
  return catalogResponse(async () => {
    const { id } = await params,
      { service } = catalog(),
      r = await service.owned(id, auth.user.id);
    if (r.status !== "approved" && r.status !== "anchor_pending")
      throw new CatalogError(
        "Independent approval is required before anchoring",
        409,
      );
    const wallets = await getServerContainer().users.listWalletsForUser(
      auth.user.id,
    );
    if (!wallets.some((w) => w.address === body.address))
      throw new CatalogError("Use your verified linked wallet", 403);
    const registry = new SolanaRegistry(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    );
    if (body.signature) {
      if (
        typeof body.signature !== "string" ||
        !/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(body.signature)
      )
        throw new CatalogError("Invalid signature");
      await registry.verify(r, body.address, body.signature);
      await catalog().repo.publish(
        id,
        r.manifestHash,
        body.signature,
        auth.user.id,
      );
      return { published: true };
    }
    if (body.signedTransaction) {
      if (
        typeof body.signedTransaction !== "string" ||
        body.signedTransaction.length > 4000
      )
        throw new CatalogError("Invalid transaction");
      return {
        signature: await registry.send(
          body.signedTransaction,
          r,
          body.address,
          await catalog().repo.history(id),
        ),
      };
    }
    return registry.prepare(r, body.address, await catalog().repo.history(id));
  });
}
