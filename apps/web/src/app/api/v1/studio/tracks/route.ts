import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { requireAuthenticatedUser } from "@/server/request-context";
import { requireStudioOwner } from "@/server/studio-auth";

export async function GET(req: Request) {
  const auth = await requireAuthenticatedUser(["artist"], req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    const channel = await requireStudioOwner(auth.user.id);
    const tracks = await catalog().repo.mine(auth.user.id);
    return {
      channel,
      tracks: tracks.map(({ audioPath, ...track }) => track),
    };
  });
}
