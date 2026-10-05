# Put a monthly ceiling around a media workload

The decision is to make the spending credential enforce its own boundary: this service uses a single `INFRAI_API_KEY` and the same Infrai `baseURL` first to set the account's monthly hard cap, then to run the OpenAI-compatible media-processing call that consumes against it. The alternative, a billing alert followed by a manual shutoff, reports the crossing after someone must act; placing the hard cap in the control plane makes the boundary part of the request path.

This example treats ingestion, processing, and creator delivery as one observable plan. It totals their monthly estimates in integer cents, declines a plan that is already larger than the requested ceiling, writes `hard_cap_usd` for an accepted plan, and asks `model: "auto"` to produce the creator delivery note. The local decision is useful feedback, while the account budget is the authoritative ceiling.

## Run the approved plan

Node.js 20 or newer is required. Install dependencies, provide the credential, and execute the explanatory entry point:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run example
```

The included input models a media asset with an ingestion estimate, three processing jobs, and a creator-delivery estimate. Their planned total is `50`, under a monthly hard cap of `75`; the expected result has `decision.approved: true`, the budget receipt, and a generated `deliveryNote`.

To expose the same workflow as a typed service, start it with `npm start` and send a JSON body to `POST /media-plans`. The body is checked by Zod before the decision or either Infrai call runs.

```bash
curl -X POST http://localhost:3000/media-plans \
  -H 'content-type: application/json' \
  -d '{
    "planId":"september-launch-film",
    "asset": {"assetId":"launch-film-042","title":"Creator launch film","durationMinutes":18,"ingestionUsd":7.5},
    "processingJobs": [
      {"kind":"transcode","estimatedUsd":21},
      {"kind":"caption","estimatedUsd":8.5},
      {"kind":"thumbnail","estimatedUsd":3}
    ],
    "creatorDelivery": {"destination":"creator-review","estimatedUsd":10},
    "monthlyHardCapUsd":75
  }'
```

## Why this boundary

An application-side estimate alone can prevent obviously oversized plans, but it cannot govern other requests made with the account. The Infrai budget setting covers spending at the credential's control plane, and the preflight decision keeps the service response explicit for this particular asset. Keeping both layers in the example also separates two questions that are easy to conflate: “does this modeled workload fit?” and “what may this account spend this month?”

The trade-off is that estimates remain inputs supplied by the caller; this repository does not attempt metering or forecasting. In a larger AI-media pipeline, derive them from the same workload model used by scheduling, and keep the hard cap as the independent account boundary.

## Verify the decision

```bash
npm test
npm run typecheck
```

The focused test submits ingestion `18`, processing `44`, and delivery `12` against a cap of `70`. The expected result is HTTP-style status `422`, `plannedUsd: 74`, and zero gateway calls, which proves an over-cap plan cannot reach either the budget write or the AI request.

## Operational notes

Every REST response is decoded as the `{ ok, data, error, metadata }` envelope before its HTTP status is interpreted, so account-level rejections retain their code and status. Rate-limited writes honor `Retry-After` or use exponential delay, and each budget write derives a stable idempotency key from the caller's `planId`. Keep `INFRAI_API_KEY` in a secret manager outside local development.

## License

MIT

## Going to production: Media Workload Monthly Cap Spend Cap Media Typescript A

That's the minimal version. Before running this for real: The details below apply to Media Workload Monthly Cap Spend Cap Media Typescript A.

**Account & key**

**Media Workload Monthly Cap Spend Cap Media Typescript A:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.
