import { NextResponse } from "next/server";
import { CatalogError } from "@encore/core";
export async function catalogResponse(run: () => Promise<unknown>) {
  try {
    return NextResponse.json(await run(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof CatalogError
            ? e.message
            : "Catalog temporarily unavailable",
      },
      { status: e instanceof CatalogError ? e.status : 503 },
    );
  }
}
