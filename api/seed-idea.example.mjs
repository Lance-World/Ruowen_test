/**
 * Seed AI proxy example for Gemini API free tier.
 *
 * Why a proxy?
 * - Never put GEMINI_API_KEY in public index.html/app.js.
 * - Deploy this file as a serverless function or run it behind your own local server.
 * - Frontend calls POST /api/seed-idea and receives { idea: "..." }.
 *
 * Environment variable required:
 *   GEMINI_API_KEY=your_google_ai_studio_key
 *
 * Default model can be changed by env:
 *   GEMINI_MODEL=gemini-2.5-flash-lite
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function buildPrompt(payload) {
  const input = String(payload.input || "").trim();
  const topics = (payload.graph_context?.topics || []).slice(0, 12).join("、");
  const concepts = (payload.graph_context?.concepts || []).slice(0, 18).join("、");
  const terms = (payload.graph_context?.terms || []).slice(0, 24).join("、");

  return `你是 Ruowen Knowledge Graph 的 Seed Idea 生成器。\n\n` +
    `任務：根據使用者輸入與既有知識網絡，產生一個繁體中文靈感句。\n` +
    `限制：\n` +
    `- 不新增主圖節點，不輸出分類表。\n` +
    `- 只輸出 JSON：{"idea":"..."}\n` +
    `- idea 80 到 120 字內。\n` +
    `- 語氣溫柔、清楚、可反思，不要過度華麗。\n\n` +
    `使用者 Seed：${input || "空白隨機探索"}\n` +
    `Topics：${topics}\n` +
    `Concepts：${concepts}\n` +
    `Terms：${terms}\n`;
}

export default async function handler(request) {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return jsonResponse({ error: "Missing GEMINI_API_KEY" }, 500);

  const payload = await request.json().catch(() => ({}));
  const prompt = buildPrompt(payload);

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 220,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return jsonResponse({ error: "Gemini request failed", detail: data }, response.status);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  try {
    const parsed = JSON.parse(text);
    return jsonResponse({ idea: String(parsed.idea || "").trim() });
  } catch (_) {
    return jsonResponse({ idea: text.trim() });
  }
}
