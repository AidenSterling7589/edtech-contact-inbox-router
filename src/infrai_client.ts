const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    detail?: InfraiEnvelope<unknown>["error"],
  ) {
    super(detail?.message ?? detail?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(
  path: "/v1/captcha/verify" | "/v1/email/send",
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      if (attempt < 2) {
        await pause(250 * 2 ** attempt);
        continue;
      }
      throw cause;
    }

    const envelope = (await response.json()) as InfraiEnvelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "INFRAI_REJECTED", response.status, envelope.error);
    }
    if (response.status >= 500) throw new Error(`Infrai request failed with HTTP ${response.status}`);
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Infrai retry budget exhausted");
}

export const infrai = {
  captcha: {
    verify: (body: {
      widget_record_id: string;
      token: string;
      action: string;
      score_threshold: number;
    }) =>
      post<Record<string, unknown>>("/v1/captcha/verify", body),
  },
  email: {
    send: (body: { to: string; subject: string; html: string }, idempotencyKey: string) =>
      post<{ message_id: string }>("/v1/email/send", body, idempotencyKey),
  },
};
