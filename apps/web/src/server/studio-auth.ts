import "server-only";
import { CatalogError } from "@encore/core";
import { getStudioChannel } from "./onboarding-access";

export async function requireStudioOwner(userId: string) {
  const channel = await getStudioChannel(userId);
  if (channel?.role !== "owner") throw new CatalogError("An artist channel owner is required", 403);
  return channel;
}
