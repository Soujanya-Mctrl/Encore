export function isLocalMusicTest(request: Request) {
  return process.env.NODE_ENV === "development" &&
    request.headers.get("host") === "127.0.0.1:3000" &&
    request.headers.get("origin") === "http://127.0.0.1:3000";
}
