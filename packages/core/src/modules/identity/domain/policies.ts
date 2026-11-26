import {
  PUBLIC_ASSIGNABLE_ROLES,
  SOLANA_ADDRESS_REGEX,
  type UserRole
} from "@encore/contracts";

export function isValidSolanaAddress(address: string): boolean {
  return SOLANA_ADDRESS_REGEX.test(address);
}

export function canPubliclyAssignRole(role: UserRole): boolean {
  return (PUBLIC_ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

export function hasAnyRole(
  userRoles: readonly UserRole[],
  required: readonly UserRole[]
): boolean {
  return required.some((r) => userRoles.includes(r));
}

export function canAccessArtistStudio(roles: readonly UserRole[]): boolean {
  return hasAnyRole(roles, ["artist", "admin"]);
}

export function canAccessReviewerQueue(roles: readonly UserRole[]): boolean {
  return hasAnyRole(roles, ["reviewer", "admin"]);
}

export function canMutateResource(
  actorUserId: string,
  resourceOwnerId: string,
  roles: readonly UserRole[]
): boolean {
  return actorUserId === resourceOwnerId || roles.includes("admin");
}
