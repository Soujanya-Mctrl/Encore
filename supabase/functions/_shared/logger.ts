export function logJobEvent(level: "info" | "warn" | "error", msg: string, meta?: unknown): void {
  console.log(JSON.stringify({ level, msg, meta, ts: new Date().toISOString() }));
}
