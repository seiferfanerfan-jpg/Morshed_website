const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 12000;
const MAX_OUTPUT_TOKENS = 512;
const MODEL = "gemini-3.5-flash-lite";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function onRequestGet({ env }) {
  return json({ configured: Boolean(env.GEMINI_API_KEY) });
}

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) {
    return json({ error: "الخدمة غير مهيّأة بعد. أضف مفتاح Gemini السري إلى إعدادات Cloudflare." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "تعذّر قراءة الطلب." }, 400);
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_CHARS) {
    return json({ error: "اكتب رسالة صالحة لا تتجاوز 4000 حرف." }, 400);
  }

  const inputHistory = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];
  const history = [];
  let historyChars = 0;
  for (const item of inputHistory) {
    if (!item || !["user", "model"].includes(item.role) || typeof item.text !== "string") continue;
    const text = item.text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!text || historyChars + text.length > MAX_HISTORY_CHARS) continue;
    history.push({ role: item.role, parts: [{ text }] });
    historyChars += text.length;
  }

  const contents = [...history, { role: "user", parts: [{ text: message }] }];
  let upstream;
  try {
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "أنت مرشد، مساعد ذكي يتحدث العربية بوضوح واحترام. أجب بلغة المستخدم، وكن دقيقًا ومفيدًا ومختصرًا. إذا لم تعرف، صرّح بذلك." }],
        },
        contents,
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
    });
  } catch {
    return json({ error: "تعذّر الاتصال بخدمة Gemini الآن. حاول لاحقًا." }, 502);
  }

  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const googleCode = result?.error?.code;
    const googleStatus = result?.error?.status;
    if (upstream.status === 429 || googleCode === 429) {
      return json({ error: "وصلت خدمة Gemini إلى حد الاستخدام المتاح حاليًا. لن نحاول التحويل إلى خطة مدفوعة؛ جرّب بعد تجدد الحصة." }, 429);
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return json({ error: "مفتاح Gemini غير صالح أو لا يملك صلاحية استخدام الخدمة." }, 502);
    }
    return json({ error: "لم يتمكن Gemini من إكمال الطلب. حاول مرة أخرى لاحقًا.", providerStatus: googleStatus || `HTTP ${upstream.status}` }, 502);
  }

  const reply = (result?.candidates?.[0]?.content?.parts ?? [])
    .map((part) => typeof part.text === "string" ? part.text : "")
    .join("")
    .trim();
  if (!reply) return json({ error: "لم يُرجع Gemini نصًا. أعد صياغة سؤالك وحاول مرة أخرى." }, 502);
  return json({ reply });
}
