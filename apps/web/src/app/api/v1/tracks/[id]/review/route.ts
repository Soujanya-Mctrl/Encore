import { NextResponse } from "next/server";
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
  const auth = await requireAuthenticatedUser(["reviewer", "admin"]);
  if (auth.errorResponse) return auth.errorResponse;
  const body = await req.json().catch(() => null);
  if (typeof body?.approve !== "boolean")
    return NextResponse.json(
      { error: "Review decision required" },
      { status: 400 },
    );
  return catalogResponse(async () => {
    await catalog().service.review(
      (await params).id,
      auth.user.id,
      body.approve,
    );
    return { ok: true };
  });
}
