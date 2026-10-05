import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { InfraiError, InfraiMediaGateway } from "./infrai_budget_client.js";
import { decideMediaPlan, mediaPlanSchema, type MediaPlanInput } from "./media_budget.js";

export interface MediaGateway {
  setMonthlyCap(hardCapUsd: number, idempotencyKey: string): Promise<Record<string, unknown>>;
  describeApprovedWorkload(input: {
    assetId: string;
    title: string;
    durationMinutes: number;
    processingKinds: string[];
    destination: string;
  }): Promise<string>;
}

export async function executeMediaPlan(input: MediaPlanInput, gateway: MediaGateway) {
  const decision = decideMediaPlan(input);
  if (!decision.approved) {
    return { status: 422, body: { decision } };
  }

  const idempotencyKey = `media-plan-${input.planId}`;
  const budget = await gateway.setMonthlyCap(input.monthlyHardCapUsd, idempotencyKey);
  const deliveryNote = await gateway.describeApprovedWorkload({
    assetId: input.asset.assetId,
    title: input.asset.title,
    durationMinutes: input.asset.durationMinutes,
    processingKinds: input.processingJobs.map((job) => job.kind),
    destination: input.creatorDelivery.destination
  });

  return { status: 200, body: { decision, budget, deliveryNote } };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body, null, 2));
}

export function createMediaServer(gateway: MediaGateway) {
  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/media-plans") {
      send(response, 404, { error: "Route not found." });
      return;
    }

    try {
      const parsed = mediaPlanSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        send(response, 400, { error: "Invalid media plan.", issues: parsed.error.issues });
        return;
      }
      const result = await executeMediaPlan(parsed.data, gateway);
      send(response, result.status, result.body);
    } catch (error) {
      if (error instanceof SyntaxError) {
        send(response, 400, { error: "Request body must be valid JSON." });
      } else if (error instanceof InfraiError) {
        const status = error.status >= 400 && error.status < 500 ? error.status : 502;
        send(response, status, { error: error.message, code: error.code });
      } else {
        send(response, 500, { error: "The media plan could not be evaluated." });
      }
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");
  const port = Number(process.env.PORT ?? 3000);
  createMediaServer(new InfraiMediaGateway(apiKey)).listen(port, () => {
    console.log(`Media spend service listening on http://localhost:${port}`);
  });
}
