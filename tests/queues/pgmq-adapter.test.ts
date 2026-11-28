import { describe, expect, it } from "vitest";
import { JobPublisher, PgmqAdapter } from "../../packages/infrastructure/src/index.js";

describe("PGMQ Queue Adapter & Publisher", () => {
  it("enqueues settlement job with idempotency key in local mode", async () => {
    const adapter = new PgmqAdapter();
    const publisher = new JobPublisher(adapter);
    const res = await publisher.publish(
      "settlement",
      "settlement.index_tx",
      { signature: "sig-123" },
      "idem-sig-123"
    );
    expect(res.messageId).toBe("local-idem-sig-123");
  });
});
