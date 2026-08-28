import type { Handler, HandlerEvent } from '@netlify/functions';
import type {
  JournalEntry,
  AnalyzeRequest,
  AnalyzeResponse,
  ErrorResponse,
  AIResponse,
} from './types';

// ---------------------------------------------------------------------------
// CORS headers applied to every response
// ---------------------------------------------------------------------------
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Device-ID',
  'Content-Type': 'application/json',
};

// ---------------------------------------------------------------------------
// System prompt
// The real prompt is injected at deploy time via WITNESSED_SYSTEM_PROMPT env
// var. The fallback below satisfies the JSON schema and basic safety rules
// so the function remains testable without that env var set.
// ---------------------------------------------------------------------------
const FALLBACK_SYSTEM_PROMPT = `You are Witnessed, a compassionate AI journaling companion. \
Respond ONLY with a valid JSON object — no markdown, no prose outside JSON.

Your JSON must conform exactly to this schema:
{
  "summary": string,                  // 1-2 sentence neutral summary of the entry
  "emotional_validation": string,     // warm, non-judgmental acknowledgment (2-3 sentences)
  "emotional_analysis": {
    "primary_emotions": string[],     // e.g. ["sadness","frustration"]
    "intensity": number | null,       // 1-10 or null if unclear
    "conflicting_emotions": string[], // emotions in tension with each other
    "values": string[],               // values the person seems to care about
    "needs": string[]                 // underlying unmet needs
  },
  "reflective_questions": string[],   // 2-3 open-ended questions (never leading)
  "next_steps": {
    "mental": string | null,
    "emotional": string | null,
    "physical": string | null
  },
  "tone_flag": "supportive" | "alert" | "escalate",
  "internal_flags": {
    "mood_elevation_watch": boolean,
    "reality_testing_concern": boolean,
    "substance_context": boolean,
    "medical_emergency_flag": boolean,
    "trauma_narration": boolean,
    "dissociative_markers": boolean,
    "grief_context": boolean,
    "grief_type": "recent_loss" | "anticipatory" | "ambiguous" | "historical" | null,
    "identity_entry": boolean,
    "human_referral_mode": boolean,
    "depth_check_triggered": boolean
  },
  "disclaimer": string | null,        // include only when tone_flag is "alert" or "escalate"
  "response_language": string,        // BCP-47 code matching the entry language, e.g. "en"
  "mood_acknowledged": boolean,       // true if you explicitly referenced the mood score
  "prompt_version": string            // always "fallback-v1"
}

Safety rules:
- Set tone_flag to "escalate" and medical_emergency_flag to true if the entry contains \
any indication of immediate danger to self or others. Always include a disclaimer in that case.
- Set tone_flag to "alert" for passive suicidal ideation, self-harm references, or acute \
crisis language. Include a disclaimer.
- Never diagnose, prescribe, or give medical advice.
- Match response_language to the language of the entry text.`;

const SYSTEM_PROMPT: string =
  process.env.WITNESSED_SYSTEM_PROMPT || FALLBACK_SYSTEM_PROMPT;

// ---------------------------------------------------------------------------
// Rate limiting via Upstash Redis REST API (no SDK — plain fetch)
// ---------------------------------------------------------------------------
const DAILY_LIMIT = 3;
const MAX_ENTRY_LENGTH = 10_000;

/** Returns seconds until midnight UTC from now. */
function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

async function checkRateLimit(
  ip: string,
  deviceId: string | null
): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    console.error('[rate-limit] Required Upstash configuration is missing');
    return { allowed: false };
  }

  const key = deviceId ? `rl:${ip}:${deviceId}` : `rl:${ip}`;
  const authHeader = { Authorization: `Bearer ${redisToken}` };

  try {
    // 1. GET current count
    const getRes = await fetch(`${redisUrl}/get/${key}`, {
      headers: authHeader,
    });
    if (!getRes.ok) throw new Error(`Redis GET failed: ${getRes.status}`);
    const getBody = await getRes.json() as { result: string | null };
    const currentCount = getBody.result ? parseInt(getBody.result, 10) : 0;

    if (currentCount >= DAILY_LIMIT) {
      return { allowed: false, retryAfter: secondsUntilMidnightUTC() };
    }

    // 2. INCR
    const incrRes = await fetch(`${redisUrl}/incr/${key}`, {
      method: 'POST',
      headers: authHeader,
    });
    if (!incrRes.ok) throw new Error(`Redis INCR failed: ${incrRes.status}`);

    // 3. EXPIRE (reset at midnight — use remaining seconds in the day)
    const ttl = secondsUntilMidnightUTC();
    await fetch(`${redisUrl}/expire/${key}/${ttl}`, {
      method: 'POST',
      headers: authHeader,
    });

    return { allowed: true };
  } catch (err) {
    // Fail closed to prevent an outage from becoming an unmetered AI proxy.
    console.error('[rate-limit] Redis error:', err);
    return { allowed: false };
  }
}

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------
function buildUserMessage(entry: JournalEntry): string {
  const toneLabel = entry.tone_preference ?? 'not specified';
  return [
    `MOOD: ${entry.mood_score}/5`,
    `TONE REQUEST: ${toneLabel}`,
    `INPUT METHOD: ${entry.input_method}`,
    `ENTRY:`,
    entry.text,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
function isValidMoodScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

function hasRequiredAIFields(parsed: unknown): parsed is AIResponse {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    typeof obj['summary'] === 'string' &&
    typeof obj['emotional_validation'] === 'string' &&
    typeof obj['tone_flag'] === 'string'
  );
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------
function jsonResponse(
  statusCode: number,
  body: AnalyzeResponse | ErrorResponse
) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export const handler: Handler = async (event: HandlerEvent) => {
  // ── CORS preflight ────────────────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  // ── Method guard ──────────────────────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('[analyze] Required AI provider configuration is missing');
    return jsonResponse(503, { success: false, error: 'Service is not configured' });
  }

  if ((event.body?.length ?? 0) > MAX_ENTRY_LENGTH + 1_000) {
    return jsonResponse(413, { success: false, error: 'Request is too large' });
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const rawIp =
    event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const ip = rawIp.split(',')[0].trim();
  const rawDeviceId = event.headers['x-device-id'] ?? null;
  const deviceId = rawDeviceId && /^[a-f0-9-]{20,64}$/i.test(rawDeviceId)
    ? rawDeviceId
    : null;

  const { allowed, retryAfter } = await checkRateLimit(ip, deviceId);
  if (!allowed) {
    return jsonResponse(429, {
      success: false,
      error: 'Daily limit reached',
      retryAfter,
    });
  }

  // ── Request parsing ───────────────────────────────────────────────────────
  let parsed: AnalyzeRequest;
  try {
    parsed = JSON.parse(event.body ?? '{}') as AnalyzeRequest;
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON body' });
  }

  const { entry } = parsed;

  if (!entry || typeof entry.text !== 'string' || entry.text.trim() === '') {
    return jsonResponse(400, {
      success: false,
      error: 'entry.text must be a non-empty string',
    });
  }

  if (entry.text.length > MAX_ENTRY_LENGTH) {
    return jsonResponse(413, {
      success: false,
      error: 'Journal entry is too large',
    });
  }

  if (!isValidMoodScore(entry.mood_score)) {
    return jsonResponse(400, {
      success: false,
      error: 'entry.mood_score must be an integer between 1 and 5',
    });
  }

  // ── OpenAI call ───────────────────────────────────────────────────────────
  let openAIRes: Response;
  try {
    openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(entry) },
        ],
      }),
    });
  } catch (err) {
    console.error('[analyze] OpenAI fetch error:', err);
    return jsonResponse(502, { success: false, error: 'AI service unavailable' });
  }

  if (!openAIRes.ok) {
    // Do not log provider response bodies; they may contain request context.
    console.error('[analyze] OpenAI non-200:', openAIRes.status);
    return jsonResponse(502, { success: false, error: 'AI service unavailable' });
  }

  // ── Parse OpenAI response ─────────────────────────────────────────────────
  let aiData: AIResponse;
  try {
    const completion = await openAIRes.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) throw new Error('Empty content from OpenAI');

    const parsedContent: unknown = JSON.parse(rawContent);
    if (!hasRequiredAIFields(parsedContent)) {
      throw new Error('Response missing required fields');
    }
    aiData = parsedContent;
  } catch (err) {
    console.error('[analyze] Response parse error:', err);
    return jsonResponse(502, {
      success: false,
      error: 'Invalid AI response format',
    });
  }

  // ── Success ───────────────────────────────────────────────────────────────
  return jsonResponse(200, { success: true, data: aiData });
};
