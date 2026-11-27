import { getServerContainer } from "./container";

export function getStudioChannel(userId: string) {
  return getServerContainer().users.findStudioChannelForUser(userId);
}

export function listReviewAssignments(userId: string) {
  return getServerContainer().users.listReviewAssignmentsForUser(userId);
}
