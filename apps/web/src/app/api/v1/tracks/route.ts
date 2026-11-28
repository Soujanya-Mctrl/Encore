import { searchDiscovery } from "@/server/discovery";
import { NextResponse } from "next/server";
import {
  CatalogQuerySchema,
  ReleaseInputSchema,
  MAX_AUDIO_BYTES,
} from "@encore/contracts";
import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { requireAuthenticatedUser } from "@/server/request-context";
export async function GET(req: Request) {
  const q = CatalogQuerySchema.safeParse(
    Object.fromEntries([...new URL(req.url).searchParams].filter(([, value]) => value !== "")),
  );
  if (!q.success)
    return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
  return catalogResponse(() => searchDiscovery(q.data));
}
export async function POST(req: Request) {
  const origin = new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ).origin;
  if (
    req.headers.get("origin") !== origin ||
    !req.headers.get("content-type")?.startsWith("multipart/form-data")
  )
    return NextResponse.json(
      { error: "Same-origin multipart upload required" },
      { status: 403 },
    );
  const auth = await requireAuthenticatedUser(["artist"]);
  if (auth.errorResponse) return auth.errorResponse;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_AUDIO_BYTES + 65536)
    return NextResponse.json(
      { error: "Upload exceeds 20 MB" },
      { status: 413 },
    );
  return catalogResponse(async () => {
    const reader = req.body?.getReader();
    if (!reader)
      throw new (await import("@encore/core")).CatalogError(
        "Upload body required",
      );
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > MAX_AUDIO_BYTES + 65536) {
        await reader.cancel();
        throw new (await import("@encore/core")).CatalogError(
          "Upload exceeds 20 MB",
          413,
        );
      }
      chunks.push(next.value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": req.headers.get("content-type")! },
    }).formData();
    let metadata;
    try {
      metadata = JSON.parse(String(form.get("metadata")));
    } catch {
      return Promise.reject(
        new (await import("@encore/core")).CatalogError("Invalid metadata"),
      );
    }
    const parsed = ReleaseInputSchema.safeParse(metadata);
    const file = form.get("audio");
    if (
      !parsed.success ||
      !(file instanceof File) ||
      file.size > MAX_AUDIO_BYTES ||
      !file.size
    )
      throw new (await import("@encore/core")).CatalogError(
        "Provide metadata, consent and an MP3 up to 20 MB",
      );
    const release = await catalog().service.upload(
      auth.user.id,
      parsed.data,
      new Uint8Array(await file.arrayBuffer()),
    );
    return { track: release };
  });
}
