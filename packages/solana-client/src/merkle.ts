import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";

const DISTRIBUTION_LEAF_DOMAIN = Buffer.from("encore:dist_claim:v1", "utf8");

export function distributionLeaf(claimer: PublicKey | string, amountSmallestUnits: bigint): Buffer {
  const pubkey = typeof claimer === "string" ? new PublicKey(claimer) : claimer;
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amountSmallestUnits, 0);
  return crypto
    .createHash("sha256")
    .update(DISTRIBUTION_LEAF_DOMAIN)
    .update(pubkey.toBuffer())
    .update(amountBuf)
    .digest();
}

function hashSortedPair(a: Buffer, b: Buffer): Buffer {
  const [first, second] = Buffer.compare(a, b) <= 0 ? [a, b] : [b, a];
  return crypto.createHash("sha256").update(first).update(second).digest();
}

export interface DistributionMerkleEntry {
  readonly claimerWallet: string;
  readonly amountSmallestUnits: bigint;
}

export function buildDistributionMerkleTree(entries: readonly DistributionMerkleEntry[]) {
  if (entries.length === 0) {
    throw new Error("Distribution Merkle tree requires at least one recipient");
  }
  const leaves = entries.map((e) => ({
    key: `${e.claimerWallet}:${e.amountSmallestUnits.toString()}`,
    hash: distributionLeaf(e.claimerWallet, e.amountSmallestUnits)
  }));

  const layers: Buffer[][] = [leaves.map((l) => l.hash)];
  while (layers[layers.length - 1]!.length > 1) {
    const prev = layers[layers.length - 1]!;
    const next: Buffer[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const left = prev[i]!;
      const right = prev[i + 1] ?? left;
      next.push(hashSortedPair(left, right));
    }
    layers.push(next);
  }

  const root = layers[layers.length - 1]![0]!;

  function getProof(claimerWallet: string, amountSmallestUnits: bigint): Buffer[] {
    let idx = leaves.findIndex(
      (l) => l.key === `${claimerWallet}:${amountSmallestUnits.toString()}`
    );
    if (idx === -1) {
      throw new Error("Recipient entitlement not found in distribution Merkle tree");
    }
    const proof: Buffer[] = [];
    for (let level = 0; level < layers.length - 1; level++) {
      const layer = layers[level]!;
      const pairIdx = idx ^ 1;
      proof.push(layer[pairIdx] ?? layer[idx]!);
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  return {
    root,
    rootHex: root.toString("hex"),
    getProof
  };
}

export function verifyDistributionMerkleProof(
  proof: readonly Buffer[],
  root: Buffer,
  leaf: Buffer
): boolean {
  let computed = leaf;
  for (const node of proof) {
    computed = hashSortedPair(computed, node);
  }
  return computed.equals(root);
}
