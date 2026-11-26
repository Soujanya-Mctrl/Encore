import { verifyJobCaller } from "../_shared/authorization.ts";
import { logJobEvent } from "../_shared/logger.ts";

// Supabase Edge Function entrypoint for bounded PGMQ job consumption
Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("JOB_RUNNER_SECRET") ?? "";
  if (!verifyJobCaller(req.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  logJobEvent("info", "process-jobs invoked");
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" }
  });
});
