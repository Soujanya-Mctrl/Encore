export const BPS_DENOMINATOR = 10_000n;
export const PRIMARY_PLATFORM_FEE_BPS = 500n; // 5%
export const RESALE_ARTIST_FEE_BPS = 1_000n; // 10%
export const RESALE_PLATFORM_FEE_BPS = 500n; // 5%

export interface PrimarySplit {
  readonly grossAmount: bigint;
  readonly artistPayout: bigint;
  readonly platformFee: bigint;
}

export interface ResaleSplit {
  readonly grossAmount: bigint;
  readonly sellerPayout: bigint;
  readonly artistFee: bigint;
  readonly platformFee: bigint;
}

export function computeBpsFloor(amount: bigint, bps: bigint): bigint {
  if (amount <= 0n) throw new Error("Amount must be positive");
  if (bps < 0n || bps > BPS_DENOMINATOR) throw new Error("Invalid BPS");
  return (amount * bps) / BPS_DENOMINATOR;
}

export function computePrimaryPassSplit(amount: bigint): PrimarySplit {
  const platformFee = computeBpsFloor(amount, PRIMARY_PLATFORM_FEE_BPS);
  const artistPayout = amount - platformFee;
  return { grossAmount: amount, artistPayout, platformFee };
}

export function computeSecondaryResaleSplit(amount: bigint): ResaleSplit {
  const artistFee = computeBpsFloor(amount, RESALE_ARTIST_FEE_BPS);
  const platformFee = computeBpsFloor(amount, RESALE_PLATFORM_FEE_BPS);
  const sellerPayout = amount - artistFee - platformFee;
  return { grossAmount: amount, sellerPayout, artistFee, platformFee };
}

export function computeProRataDistributionClaim(params: {
  verifiedRevenue: bigint;
  totalClaimedSoFar: bigint;
  holderUnits: bigint;
  totalSupplySnapshot: bigint;
}): bigint {
  if (params.holderUnits <= 0n || params.totalSupplySnapshot <= 0n) {
    throw new Error("Units and total supply must be positive");
  }
  if (params.holderUnits > params.totalSupplySnapshot) {
    throw new Error("Holder units cannot exceed snapshot supply");
  }
  const rawEntitled =
    (params.verifiedRevenue * params.holderUnits) / params.totalSupplySnapshot;
  const remainingPool = params.verifiedRevenue - params.totalClaimedSoFar;
  if (remainingPool <= 0n) return 0n;
  return rawEntitled > remainingPool ? remainingPool : rawEntitled;
}
