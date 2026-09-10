export const FEEDBACK_MODES = ['review', 'diff', 'lexical', 'semantic'] as const;
export type FeedbackMode = typeof FEEDBACK_MODES[number];
export type FeedbackPayload = {
  sessionId: string;
  visitedModes: FeedbackMode[];
  activeMs: number;
  rating: number;
  preferredMode: FeedbackMode;
  comment: string;
};

export function validateFeedback(value: unknown): FeedbackPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.sessionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.sessionId)) return null;
  if (!Array.isArray(body.visitedModes) || body.visitedModes.length !== 4 ||
    !FEEDBACK_MODES.every(mode => (body.visitedModes as unknown[]).includes(mode))) return null;
  if (typeof body.activeMs !== 'number' || !Number.isSafeInteger(body.activeMs) || body.activeMs <= 600_000) return null;
  if (typeof body.rating !== 'number' || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) return null;
  if (!FEEDBACK_MODES.includes(body.preferredMode as FeedbackMode)) return null;
  if (body.comment !== undefined && (typeof body.comment !== 'string' || body.comment.length > 2000)) return null;
  return {
    sessionId: body.sessionId.toLowerCase(),
    visitedModes: [...FEEDBACK_MODES],
    activeMs: body.activeMs,
    rating: body.rating,
    preferredMode: body.preferredMode as FeedbackMode,
    comment: typeof body.comment === 'string' ? body.comment.trim() : '',
  };
}

export function isSameOriginRequest(request: Request, siteUrl: string) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  const allowed = new Set([new URL(request.url).origin]);
  if (siteUrl) {
    try { allowed.add(new URL(siteUrl).origin); } catch { /* Ignore malformed optional config. */ }
  }
  return allowed.has(origin);
}

export async function readFeedbackJson(request: Request, maxBytes = 16_384): Promise<unknown> {
  const size = Number(request.headers.get('content-length'));
  if (Number.isFinite(size) && size > maxBytes) throw new Error('BODY_TOO_LARGE');
  if (!request.body) throw new Error('INVALID_JSON');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error('BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
