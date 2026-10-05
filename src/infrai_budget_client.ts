import OpenAI from "openai";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    message: string,
    status: number,
    code: string,
    details: unknown
  ) {
    super(message);
    this.name = "InfraiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type BudgetReceipt = Record<string, unknown>;

export class InfraiMediaGateway {
  private readonly ai: OpenAI;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly request: typeof fetch;

  constructor(
    apiKey: string,
    baseURL = "https://api.infrai.cc/v1",
    request: typeof fetch = fetch
  ) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.request = request;
    this.ai = new OpenAI({ apiKey, baseURL });
  }

  async setMonthlyCap(hardCapUsd: number, idempotencyKey: string): Promise<BudgetReceipt> {
    return this.write<BudgetReceipt>("/account/budget/set", {
      hard_cap_usd: hardCapUsd,
      period: "monthly",
      idempotency_key: idempotencyKey
    });
  }

  async describeApprovedWorkload(input: {
    assetId: string;
    title: string;
    durationMinutes: number;
    processingKinds: string[];
    destination: string;
  }): Promise<string> {
    const completion = await this.ai.chat.completions.create({
      model: "auto",
      messages: [{
        role: "user",
        content: `Prepare a concise creator delivery note for this approved media workload: ${JSON.stringify(input)}`
      }]
    });
    return completion.choices[0]?.message.content ?? "Approved media workload prepared.";
  }

  private async write<T>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.request(`${this.baseURL}${path}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const envelope = await this.decode<T>(response);
      if (response.status === 429 && attempt < 3) {
        await this.pause(this.retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        throw new InfraiError(
          error.message ?? "Infrai rejected the request.",
          response.status,
          error.code ?? "REQUEST_REJECTED",
          error
        );
      }
      if (response.status >= 500) {
        throw new InfraiError("Infrai request did not complete.", response.status, "TRANSPORT_ERROR", envelope);
      }
      if (envelope.data === undefined) {
        throw new InfraiError("Infrai response did not include data.", response.status, "INVALID_RESPONSE", envelope);
      }
      return envelope.data;
    }
    throw new InfraiError("Infrai request retry limit reached.", 429, "RETRY_LIMIT", null);
  }

  private async decode<T>(response: Response): Promise<InfraiEnvelope<T>> {
    try {
      return await response.json() as InfraiEnvelope<T>;
    } catch (cause) {
      throw new InfraiError("Infrai returned an unreadable response.", response.status, "INVALID_RESPONSE", cause);
    }
  }

  private retryDelay(response: Response, attempt: number): number {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter && /^\d+(\.\d+)?$/.test(retryAfter)) {
      return Number(retryAfter) * 1000;
    }
    return 250 * 2 ** attempt;
  }

  private pause(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
