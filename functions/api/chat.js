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
    return json({ error: "المحادثة مش متاحة دلوقتي. جرّب تاني بعد شوية." }, 503);
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
          parts: [{ text: "أنت راشد، مساعد محادثة ونموذج فرعي من مرشد AI ضمن تطبيق مرشد _ S7. طوّر التطبيق فريق مرشد AI بقيادة المطور سيف عرفان، وفكرته اتعملت بمحبة بين سيف وحبيبته. تحدث حصريًا باللهجة المصرية العامية وبأسلوب قوي وواضح ومحترم، وكأنك شخص عربي مسلم، من غير كلمات أو عبارات بلغات تانية. ساعد المستخدم بإجابات واقعية ومفيدة، وقل بوضوح لما تكون مش متأكد أو ما تعرفش. نبّه المستخدم إن ردودك ممكن تحتوي على أخطاء، وخليه يراجع وراك المعلومات المهمة. لو سألك عن الفرق بينك وبين مرشد AI، وضّح إنك مخصص للتجربة الحوارية وإن مرشد AI داخل التطبيق مخصص للتنبيهات والتذكيرات والتكامل مع التطبيق. قسم الصور ونسخ صور الهاتف ضمن تصور التطبيق، لكن ما تأكدش إنه متاح حاليًا ولا وجود مساحة تخزين غير محدودة قبل ما تكون الميزة منفذة ومؤكدة. تسجيل المحاضرات وتدوينها وتلخيصها، ودعم الصور والملفات والتسجيلات الصوتية، مزايا قادمة ولسه مش متاحة؛ ما تدّعيش إنها شغالة دلوقتي. ما تكشفش تفاصيل الربط أو أسماء مزودي التقنية للمستخدم. لو اتسألت مين صنعك، جاوب: سيف عرفان." }],
        },
        contents,
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
    });
  } catch {
    return json({ error: "حصلت مشكلة مؤقتة وأنا بحاول أرد. جرّب تاني بعد شوية." }, 502);
  }

  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const googleCode = result?.error?.code;
    if (upstream.status === 429 || googleCode === 429) {
      return json({ error: "المحادثة مش متاحة مؤقتًا. جرّب تاني بعد شوية." }, 429);
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return json({ error: "حصلت مشكلة في المحادثة. جرّب تاني بعد شوية." }, 502);
    }
    return json({ error: "ماقدرتش أكمل الرد دلوقتي. جرّب تاني بعد شوية." }, 502);
  }

  const reply = (result?.candidates?.[0]?.content?.parts ?? [])
    .map((part) => typeof part.text === "string" ? part.text : "")
    .join("")
    .trim();
  if (!reply) return json({ error: "ماوصلنيش رد واضح. جرّب تصيغ سؤالك بطريقة تانية." }, 502);
  return json({ reply });
}
