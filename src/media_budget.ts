import { z } from "zod";

const usd = z.number().finite().nonnegative();

export const mediaPlanSchema = z.object({
  planId: z.string().min(1),
  asset: z.object({
    assetId: z.string().min(1),
    title: z.string().min(1),
    durationMinutes: z.number().finite().positive(),
    ingestionUsd: usd
  }),
  processingJobs: z.array(z.object({
    kind: z.enum(["transcode", "caption", "thumbnail"]),
    estimatedUsd: usd
  })).min(1),
  creatorDelivery: z.object({
    destination: z.string().min(1),
    estimatedUsd: usd
  }),
  monthlyHardCapUsd: z.number().finite().positive()
});

export type MediaPlanInput = z.infer<typeof mediaPlanSchema>;

export type MediaPlanDecision = {
  approved: boolean;
  plannedUsd: number;
  remainingUsd: number;
  breakdown: {
    ingestionUsd: number;
    processingUsd: number;
    deliveryUsd: number;
  };
  reason: string;
};

const cents = (value: number): number => Math.round(value * 100);
const dollars = (value: number): number => value / 100;

export function decideMediaPlan(input: MediaPlanInput): MediaPlanDecision {
  const ingestion = cents(input.asset.ingestionUsd);
  const processing = input.processingJobs.reduce(
    (total, job) => total + cents(job.estimatedUsd),
    0
  );
  const delivery = cents(input.creatorDelivery.estimatedUsd);
  const planned = ingestion + processing + delivery;
  const cap = cents(input.monthlyHardCapUsd);
  const approved = planned <= cap;

  return {
    approved,
    plannedUsd: dollars(planned),
    remainingUsd: dollars(Math.max(0, cap - planned)),
    breakdown: {
      ingestionUsd: dollars(ingestion),
      processingUsd: dollars(processing),
      deliveryUsd: dollars(delivery)
    },
    reason: approved
      ? "The modeled workload fits within the requested monthly ceiling."
      : "The modeled workload exceeds the requested monthly ceiling."
  };
}
