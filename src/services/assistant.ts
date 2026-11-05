export type AssistantRole = 'user' | 'model';

export type AssistantMessage = {
  role: AssistantRole;
  text: string;
  analysis?: string;
};

export type AssistantMode = 'chat' | 'quiz';

type ChatResponse = {
  reply?: string;
  error?: string;
};

export async function getAssistantStatus(): Promise<boolean> {
  try {
    const response = await fetch('/api/chat', { headers: { accept: 'application/json' } });
    if (!response.ok) return false;
    const result = await response.json() as { configured?: boolean };
    return result.configured === true;
  } catch {
    return false;
  }
}

export async function sendToAssistant(message: string, history: AssistantMessage[], mode: AssistantMode = 'chat', expanded = false): Promise<string> {
  const expandedInstruction = 'قدّم إجابة أعمق ومنظمة، واشرح النتائج والأسباب المهمة بوضوح، مع أمثلة أو خطوات عملية عند الحاجة. لا تعرض سلسلة التفكير الداخلية حرفيًا؛ اكتفِ بخلاصة التبرير والنتائج.';
  const appendInstruction = expanded && message.length + expandedInstruction.length + 2 <= 4000;
  const requestMessage = appendInstruction ? `${message}\n\n${expandedInstruction}` : message;
  const requestHistory = expanded && !appendInstruction
    ? [...history.slice(-8), { role: 'user' as const, text: expandedInstruction }]
    : history;
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ message: requestMessage, history: requestHistory, mode }),
  });
  const result = await response.json() as ChatResponse;
  if (!response.ok || typeof result.reply !== 'string') {
    throw new Error(result.error || 'تعذّر إرسال الرسالة إلى مرشد. حاول مرة أخرى.');
  }
  return result.reply;
}

export async function getAnalysisSummary(question: string, history: AssistantMessage[]): Promise<string> {
  const prompt = [
    'راجع سؤال المستخدم السابق واكتب ملخصًا موجزًا قابلًا للمشاركة لطريقة التعامل معه.',
    'في نقطتين أو ثلاث نقاط، وضّح ما فهمته وأهم الجوانب التي ستغطيها في الإجابة.',
    'لا تعرض سلسلة التفكير الداخلية أو خطوات التفكير الحرفية، ولا تكتب الإجابة النهائية هنا.',
    'استخدم اللهجة المصرية والعربية فقط واجعل الملخص واضحًا ومفيدًا للمستخدم.',
  ].join('\n\n');
  const context = [...history.slice(-8), { role: 'user' as const, text: question }];
  return sendToAssistant(prompt, context, 'chat');
}
