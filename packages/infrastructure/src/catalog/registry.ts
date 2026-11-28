import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  REGISTRY_PROGRAM_ID,
  registryAddresses,
  registryTransaction,
  discriminator,
} from "@encore/solana-client";
import { CatalogError, type Release } from "@encore/core";
export class SolanaRegistry {
  readonly connection: Connection;
  constructor(rpc: string) {
    this.connection = new Connection(rpc, "finalized");
  }
  async devnet() {
    if (
      (await this.connection.getGenesisHash()) !==
      "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
    )
      throw new CatalogError("Registry requires Solana devnet", 503);
  }
  async prepare(
    r: Release,
    address: string,
    history: { manifest: Release["manifest"]; manifest_hash: string }[],
  ) {
    await this.devnet();
    const authority = new PublicKey(address),
      a = registryAddresses(authority, r.id, r.manifest.version);
    const [program, artist] = await Promise.all([
      this.connection.getAccountInfo(REGISTRY_PROGRAM_ID),
      this.connection.getAccountInfo(a.artist),
    ]);
    if (!program?.executable)
      throw new CatalogError("Registry program is not deployed", 503);
    const current = await this.connection.getAccountInfo(a.track);
    const existingVersion = current?.data.readUInt32LE(72) ?? 0;
    if (existingVersion > r.manifest.version)
      throw new CatalogError(
        "Chain version is newer; refresh the release",
        409,
      );
    if (
      current &&
      (!current.owner.equals(REGISTRY_PROGRAM_ID) ||
        current.data[108] !== 0 ||
        current.data.subarray(76, 108).toString("hex") !==
          history.find((h) => h.manifest.version === existingVersion)
            ?.manifest_hash)
    )
      throw new CatalogError(
        "Existing chain history conflicts with this release",
        409,
      );
    const latest = await this.connection.getLatestBlockhash();
    const batches: Transaction[] = [];
    let batch = new Transaction();
    let includeArtist = !artist;
    for (const h of history.filter(
      (h) => h.manifest.version > existingVersion,
    )) {
      const next = registryTransaction(
        authority,
        r.id,
        h.manifest.version,
        h.manifest_hash,
        h.manifest.previousHash,
        includeArtist,
      );
      includeArtist = false;
      batch.feePayer = authority;
      batch.recentBlockhash = latest.blockhash;
      const candidate = new Transaction({
        feePayer: authority,
        recentBlockhash: latest.blockhash,
      }).add(...batch.instructions, ...next.instructions);
      let fits = true;
      try {
        candidate.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });
      } catch {
        fits = false;
      }
      if (!fits && batch.instructions.length) {
        batches.push(batch);
        batch = new Transaction({
          feePayer: authority,
          recentBlockhash: latest.blockhash,
        }).add(...next.instructions);
      } else batch = candidate;
    }
    if (batch.instructions.length) batches.push(batch);
    // If a prior confirmation timed out, retry publication with its finalized receipt.
    const signatures = !batches.length
      ? await this.connection.getSignaturesForAddress(
          a.passport,
          { limit: 1 },
          "finalized",
        )
      : [];
    return {
      transactions: batches.map((tx) =>
        tx
          .serialize({ requireAllSignatures: false, verifySignatures: false })
          .toString("base64"),
      ),
      existingSignature: signatures[0]?.signature,
      ...latest,
      passport: a.passport.toBase58(),
      programId: REGISTRY_PROGRAM_ID.toBase58(),
      cluster: "devnet",
    };
  }
  async verify(r: Release, address: string, signature: string) {
    await this.devnet();
    const authority = new PublicKey(address),
      a = registryAddresses(authority, r.id, r.manifest.version);
    const [p, t, tx] = await Promise.all([
      this.connection.getAccountInfo(a.passport, "finalized"),
      this.connection.getAccountInfo(a.track, "finalized"),
      this.connection.getParsedTransaction(signature, {
        commitment: "finalized",
        maxSupportedTransactionVersion: 0,
      }),
    ]);
    if (
      !p ||
      !t ||
      !p.owner.equals(REGISTRY_PROGRAM_ID) ||
      !t.owner.equals(REGISTRY_PROGRAM_ID) ||
      !tx ||
      tx.meta?.err ||
      !tx.transaction.message.instructions.some((i) =>
        i.programId.equals(REGISTRY_PROGRAM_ID),
      ) ||
      !tx.transaction.message.accountKeys.some((k) =>
        k.pubkey.equals(a.passport),
      )
    )
      throw new CatalogError(
        "Finalized registry commitment not found; retry confirmation",
        409,
      );
    if (
      !p.data.subarray(0, 8).equals(discriminator("account:PassportVersion")) ||
      !p.data.subarray(8, 40).equals(a.track.toBuffer()) ||
      p.data.readUInt32LE(40) !== r.manifest.version ||
      p.data.subarray(44, 76).toString("hex") !==
        (r.manifest.previousHash ?? "0".repeat(64)) ||
      p.data.subarray(76, 108).toString("hex") !== r.manifestHash ||
      !t.data.subarray(0, 8).equals(discriminator("account:Track")) ||
      !t.data.subarray(8, 40).equals(a.artist.toBuffer()) ||
      t.data.readUInt32LE(72) !== r.manifest.version ||
      t.data.subarray(76, 108).toString("hex") !== r.manifestHash ||
      t.data[108] !== 0
    )
      throw new CatalogError(
        "Chain commitment does not match this Passport",
        409,
      );
  }
  async send(
    signed: string,
    r: Release,
    address: string,
    history: { manifest: Release["manifest"]; manifest_hash: string }[],
  ) {
    await this.devnet();
    let tx: Transaction;
    try {
      tx = Transaction.from(Buffer.from(signed, "base64"));
    } catch {
      throw new CatalogError("Invalid signed transaction");
    }
    const authority = new PublicKey(address);
    if (
      !tx.feePayer?.equals(authority) ||
      !tx.verifySignatures() ||
      !tx.instructions.length ||
      tx.instructions.some((i) => !i.programId.equals(REGISTRY_PROGRAM_ID))
    )
      throw new CatalogError(
        "Only wallet-approved registry instructions are accepted",
      );
    const expected = history.flatMap(
      (h) =>
        registryTransaction(
          authority,
          r.id,
          h.manifest.version,
          h.manifest_hash,
          h.manifest.previousHash,
          false,
        ).instructions,
    );
    expected.push(
      registryTransaction(authority, r.id, 1, r.manifestHash, null, true)
        .instructions[0]!,
    );
    if (
      tx.instructions.some(
        (i) =>
          !expected.some(
            (e) =>
              e.data.equals(i.data) &&
              e.keys.length === i.keys.length &&
              e.keys.every(
                (k, j) =>
                  k.pubkey.equals(i.keys[j]!.pubkey) &&
                  k.isSigner === i.keys[j]!.isSigner &&
                  (!k.isWritable || i.keys[j]!.isWritable),
              ),
          ),
      )
    )
      throw new CatalogError("Transaction does not match the reviewed release");
    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });
    const confirmation = await this.connection.confirmTransaction(
      signature,
      "confirmed",
    );
    if (confirmation.value.err)
      throw new CatalogError("Registry transaction failed", 409);
    return signature;
  }
}
