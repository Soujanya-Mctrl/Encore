import { err, ok, type Result } from "../../../../kernel/result.js";
import type { ClockPort } from "../../../../kernel/ports.js";
import { isValidSolanaAddress } from "../../domain/policies.js";
import type {
  ChallengeRepositoryPort,
  SignatureVerifierPort
} from "../ports/identity.ports.js";

export async function verifyWalletChallenge(
  challenges: ChallengeRepositoryPort,
  verifier: SignatureVerifierPort,
  clock: ClockPort,
  params: {
    address: string;
    nonce: string;
    message: string;
    messageDigest: string;
    intendedAction: "login" | "link_wallet";
    signatureBase64: string;
  }
): Promise<Result<{ address: string; intendedAction: "login" | "link_wallet" }, Error>> {
  if (!isValidSolanaAddress(params.address)) {
    return err(new Error("Invalid Solana address"));
  }
  const verifiedSig = await verifier.verifyEd25519({
    address: params.address,
    message: params.message,
    signatureBase64: params.signatureBase64
  });
  if (!verifiedSig) {
    return err(new Error("Invalid wallet signature"));
  }

  const consumed = await challenges.consumeChallenge(
    params.nonce,
    params.address,
    clock.now(),
    params.messageDigest,
    params.intendedAction
  );
  if (!consumed) {
    return err(new Error("Invalid or expired wallet challenge"));
  }

  return ok({ address: params.address, intendedAction: consumed.intendedAction });
}
