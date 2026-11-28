import { createQueueClient } from "../_shared/queue-client.ts";
import { createJobWorker } from "./worker.ts";

const projectUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
Deno.serve(createJobWorker({
  secret: Deno.env.get("JOB_RUNNER_SECRET") ?? "",
  client: projectUrl && serviceRoleKey ? createQueueClient(projectUrl, serviceRoleKey) : null,
}));
