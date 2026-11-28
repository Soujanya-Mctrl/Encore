import type { OriginCategory, RightsCapabilities, RightsDeclaration, RightsRecord } from "@encore/contracts";

export const restrictedRights = (): RightsCapabilities => ({ preview: false, licenseUses: [], externalUrl: null });

function officialListing(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.origin !== "https://elevenlabs.io" || url.username || url.password ||
        !/^\/(?:app\/music(?:\/marketplace)?|music)\/[a-zA-Z0-9/_-]+$/.test(url.pathname) ||
        url.search || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function reviewRights(declaration: RightsDeclaration, origin: OriginCategory, now: Date, aiSignal = false): RightsCapabilities {
  const result = restrictedRights();
  if (!(Date.parse(declaration.validUntil) > now.getTime())) return result;
  const { provider } = declaration;
  const providerEvidence = Boolean(declaration.termsDigest && declaration.providerPlan &&
    declaration.providerPlan !== "unknown" && declaration.generatedAt && Date.parse(declaration.generatedAt) <= now.getTime());
  if (provider === "elevenlabs" && providerEvidence && declaration.masterAuthority &&
      declaration.compositionAuthority && declaration.contributorsCleared && declaration.inputsCleared) {
    result.externalUrl = officialListing(declaration.providerListing);
  }
  if (!declaration.masterAuthority || !declaration.compositionAuthority || !declaration.contributorsCleared ||
      !declaration.inputsCleared || origin === "UNKNOWN") return result;
  if (provider === "original") {
    if (origin !== "HUMAN_CREATED" || aiSignal) return result;
    result.preview = declaration.worldwidePreview;
    result.licenseUses = [...new Set(declaration.licenseUses)];
  } else if (providerEvidence) {
    // Encore requires documented written permission for library hosting where
    // a provider plan alone does not establish this platform's allowed use.
    result.preview = declaration.worldwidePreview && (
      (provider === "suno" && declaration.providerPlan !== "free") ||
      (["elevenlabs", "other"].includes(provider) && declaration.writtenHostingPermission)
    );
  }
  return result;
}

export function effectiveRights(record: RightsRecord | undefined, now: Date): RightsCapabilities {
  if (!record || record.status !== "approved" || !(Date.parse(record.declaration.validUntil) > now.getTime())) {
    return restrictedRights();
  }
  return record.capabilities;
}
