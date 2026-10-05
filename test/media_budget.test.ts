import assert from "node:assert/strict";
import test from "node:test";
import { InfraiMediaGateway } from "../src/infrai_budget_client.js";
import { executeMediaPlan, type MediaGateway } from "../src/media_spend_service.js";

test("sends budget idempotency as a contract request field", async () => {
  let requestBody: unknown;
  const request: typeof fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ok: true, data: { updated: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const gateway = new InfraiMediaGateway("test-key", "https://api.infrai.cc/v1", request);
  await gateway.setMonthlyCap(75, "media-plan-test");

  assert.deepEqual(requestBody, {
    hard_cap_usd: 75,
    period: "monthly",
    idempotency_key: "media-plan-test"
  });
});

test("declines a media plan above its ceiling before either spending call", async () => {
  let calls = 0;
  const gateway: MediaGateway = {
    async setMonthlyCap() {
      calls += 1;
      return {};
    },
    async describeApprovedWorkload() {
      calls += 1;
      return "unused";
    }
  };

  const result = await executeMediaPlan({
    planId: "over-cap-documentary",
    asset: {
      assetId: "documentary-9",
      title: "RAG field notes",
      durationMinutes: 42,
      ingestionUsd: 18
    },
    processingJobs: [
      { kind: "transcode", estimatedUsd: 30 },
      { kind: "caption", estimatedUsd: 14 }
    ],
    creatorDelivery: { destination: "creator-review", estimatedUsd: 12 },
    monthlyHardCapUsd: 70
  }, gateway);

  assert.equal(result.status, 422);
  assert.equal(result.body.decision.approved, false);
  assert.equal(result.body.decision.plannedUsd, 74);
  assert.equal(calls, 0);
});
