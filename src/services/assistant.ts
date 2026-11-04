export type AssistantStatus = 'not-configured';

export const assistantStatus: AssistantStatus = 'not-configured';

/**
 * API integration intentionally remains disabled until the owner provides its
 * endpoint and authentication requirements. No user message is transmitted.
 */
export async function sendToAssistant(_message: string): Promise<never> {
  throw new Error('ASSISTANT_API_NOT_CONFIGURED');
}
