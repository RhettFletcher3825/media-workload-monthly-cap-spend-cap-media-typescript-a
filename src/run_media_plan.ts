import { InfraiMediaGateway } from "./infrai_budget_client.js";
import { executeMediaPlan } from "./media_spend_service.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example.");

const result = await executeMediaPlan({
  planId: "september-launch-film",
  asset: {
    assetId: "launch-film-042",
    title: "Creator launch film",
    durationMinutes: 18,
    ingestionUsd: 7.5
  },
  processingJobs: [
    { kind: "transcode", estimatedUsd: 21 },
    { kind: "caption", estimatedUsd: 8.5 },
    { kind: "thumbnail", estimatedUsd: 3 }
  ],
  creatorDelivery: {
    destination: "creator-review",
    estimatedUsd: 10
  },
  monthlyHardCapUsd: 75
}, new InfraiMediaGateway(apiKey));

console.log(JSON.stringify(result.body, null, 2));
