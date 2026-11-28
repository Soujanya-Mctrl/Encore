import { createHash } from "node:crypto";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { REGISTRY_ADDRESS } from "./generated/program-address.js";
export const REGISTRY_PROGRAM_ID = new PublicKey(REGISTRY_ADDRESS);
export const discriminator = (name: string) =>
  createHash("sha256").update(name).digest().subarray(0, 8);
export const trackIdHash = (id: string) =>
  createHash("sha256").update(id).digest();
export function registryAddresses(
  authority: PublicKey,
  id: string,
  version: number,
) {
  const v = Buffer.alloc(4);
  v.writeUInt32LE(version);
  const artist = PublicKey.findProgramAddressSync(
    [Buffer.from("artist"), authority.toBuffer()],
    REGISTRY_PROGRAM_ID,
  )[0];
  const track = PublicKey.findProgramAddressSync(
    [Buffer.from("track"), artist.toBuffer(), trackIdHash(id)],
    REGISTRY_PROGRAM_ID,
  )[0];
  const passport = PublicKey.findProgramAddressSync(
    [Buffer.from("passport"), track.toBuffer(), v],
    REGISTRY_PROGRAM_ID,
  )[0];
  return { artist, track, passport };
}
export function registryTransaction(
  authority: PublicKey,
  id: string,
  version: number,
  hash: string,
  previousHash: string | null,
  registerArtist: boolean,
) {
  const { artist, track, passport } = registryAddresses(authority, id, version);
  const key = (pubkey: PublicKey, isSigner = false, isWritable = true) => ({
    pubkey,
    isSigner,
    isWritable,
  });
  const tx = new Transaction();
  if (registerArtist)
    tx.add(
      new TransactionInstruction({
        programId: REGISTRY_PROGRAM_ID,
        keys: [
          key(authority, true),
          key(artist),
          key(SystemProgram.programId, false, false),
        ],
        data: Buffer.concat([
          discriminator("global:register_artist"),
          createHash("sha256").update(authority.toBuffer()).digest(),
        ]),
      }),
    );
  const v = Buffer.alloc(4);
  v.writeUInt32LE(version);
  tx.add(
    new TransactionInstruction({
      programId: REGISTRY_PROGRAM_ID,
      keys: [
        key(authority, true),
        key(artist, false, false),
        key(track),
        key(passport),
        key(SystemProgram.programId, false, false),
      ],
      data:
        version === 1
          ? Buffer.concat([
              discriminator("global:register_track"),
              trackIdHash(id),
              Buffer.from(hash, "hex"),
            ])
          : Buffer.concat([
              discriminator("global:append_version"),
              v,
              Buffer.from(previousHash!, "hex"),
              Buffer.from(hash, "hex"),
            ]),
    }),
  );
  return tx;
}
