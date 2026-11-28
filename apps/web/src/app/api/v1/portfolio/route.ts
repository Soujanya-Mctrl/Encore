import { NextResponse } from "next/server";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function GET(req: Request) {
  const auth = await requireAuthenticatedUser(undefined, req);
  if (auth.errorResponse) return auth.errorResponse;

  const { marketplace, users } = getServerContainer();
  const [wallets, portfolio, snapshot] = await Promise.all([
    users.listWalletsForUser(auth.user.id),
    marketplace.getPortfolioForUser
      ? marketplace.getPortfolioForUser(auth.user.id)
      : Promise.all([
          marketplace.listPassesByOwner(auth.user.id),
          marketplace.listReceiptsForUser(auth.user.id)
        ]).then(([passes, receipts]) => ({ passes, receipts, spotListings: [] })),
    marketplace.getMarketplaceSnapshot()
  ]);

  const shareBalances = await Promise.all(
    snapshot.campaigns.map(async (campaign) => ({
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      units: await marketplace.getHolderShareUnits(campaign.id, auth.user.id)
    }))
  );

  return NextResponse.json(
    {
      user: {
        id: auth.user.id,
        displayName: auth.user.displayName,
        roles: auth.user.roles
      },
      wallets,
      passes: portfolio.passes,
      receipts: portfolio.receipts,
      spotListings: portfolio.spotListings,
      shareBalances: shareBalances.filter((s) => s.units > 0)
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
