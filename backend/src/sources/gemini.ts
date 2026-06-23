/**
 * Shared Gemini JSON helper — the single place the backend talks to Gemini.
 *
 * POSTs a system instruction + user text and returns the parsed JSON object,
 * with the shape forced by `responseSchema` so there's nothing brittle to parse.
 * Returns null on any failure or a missing GEMINI_API_KEY (callers degrade to
 * their heuristic / empty path).
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function geminiJSON<T = any>(
  systemInstruction: string,
  userText: string,
  responseSchema: Record<string, unknown>,
  timeoutMs = 15000
): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) {
    console.warn("[gemini] no GEMINI_API_KEY set — skipping");
    return null;
  }
  if (!userText) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    });
    if (!res.ok) {
      // Surface the REAL reason (404 dead model, 429 quota, 400 bad schema…).
      const body = await res.text().catch(() => "");
      console.warn(`[gemini] HTTP ${res.status} (${GEMINI_MODEL}): ${body.slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err: any) {
    console.warn(`[gemini] error (${GEMINI_MODEL}): ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
