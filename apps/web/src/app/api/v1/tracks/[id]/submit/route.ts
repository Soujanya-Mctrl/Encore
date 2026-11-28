import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { requireAuthenticatedUser } from "@/server/request-context";
import { rejectCrossOriginRequest } from "@/server/request-security";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rejected = rejectCrossOriginRequest(req);
  if (rejected) return rejected;
  const auth = await requireAuthenticatedUser(["artist"]);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    await catalog().service.submit((await params).id, auth.user.id);
    return { ok: true };
  });
}
