export type AssistantRole = 'user' | 'model';

export type AssistantMessage = {
  role: AssistantRole;
  text: string;
};

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

export async function sendToAssistant(message: string, history: AssistantMessage[]): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  const result = await response.json() as ChatResponse;
  if (!response.ok || typeof result.reply !== 'string') {
    throw new Error(result.error || 'تعذّر إرسال الرسالة إلى مرشد. حاول مرة أخرى.');
  }
  return result.reply;
}
