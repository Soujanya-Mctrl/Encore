import { NextResponse, type NextRequest } from "next/server";

function allowedOrigins() {
  const values = [process.env.ENCORE_AUTH_ORIGIN, process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.ENCORE_WEB_CLIENT_ORIGINS ?? "").split(",")];
  return new Set(values.flatMap((value) => {
    if (!value) return [];
    try {
      const url = new URL(value.trim());
      const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
      const validProtocol = url.protocol === "https:" || localHttp || process.env.NODE_ENV !== "production" && url.protocol === "http:";
      return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" && validProtocol ? [url.origin] : [];
    } catch { return []; }
  }));
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) return NextResponse.next();

  const headers = new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "600",
    vary: "Origin"
  });
  if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });
  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = { matcher: ["/api/v1/:path*"] };
