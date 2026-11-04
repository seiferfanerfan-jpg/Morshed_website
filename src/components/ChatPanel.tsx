import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getAssistantStatus, sendToAssistant, type AssistantMessage } from '../services/assistant';

const suggestions = [
  'اشرح لي فكرة معقدة ببساطة',
  'ساعدني في كتابة رسالة واضحة',
  'رتّب أفكاري في خطة عملية',
];

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m12 3 1.65 5.35L19 10l-5.35 1.65L12 17l-1.65-5.35L5 10l5.35-1.65L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" fill="currentColor" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5m0 0L6 11m6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ChatPanel() {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getAssistantStatus().then(setIsConfigured);
  }, []);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  const chooseSuggestion = (text: string) => {
    setDraft(text);
    setNotice('');
    textareaRef.current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSending) return;
    if (!isConfigured) {
      setNotice('Gemini غير مهيّأ بعد. أضف مفتاح GEMINI_API_KEY السرّي إلى Cloudflare ثم أعد المحاولة.');
      return;
    }

    setNotice('');
    setDraft('');
    setIsSending(true);
    try {
      const reply = await sendToAssistant(message, messages.slice(-10));
      setMessages((current) => [...current, { role: 'user', text: message }, { role: 'model', text: reply }]);
    } catch (error) {
      setDraft(message);
      setNotice(error instanceof Error ? error.message : 'حدث خطأ غير متوقع. حاول مرة أخرى.');
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  return (
    <section className="chat-panel" aria-labelledby="welcome-title">
      <div className="chat-panel__welcome">
        <span className="assistant-orbit" aria-hidden="true"><SparkleIcon /></span>
        <p className="eyebrow">مساحة مرشد</p>
        <h1 id="welcome-title">أهلًا، أنا <span>مرشد</span></h1>
        <p className="welcome-copy">ما الفكرة التي تحب أن نبدأ بها اليوم؟</p>
      </div>

      {messages.length > 0 && (
        <div className="conversation" ref={conversationRef} aria-live="polite" aria-label="المحادثة">
          {messages.map((item, index) => (
            <article className={`conversation__message conversation__message--${item.role}`} key={`${index}-${item.role}`}>
              <span className="conversation__speaker">{item.role === 'user' ? 'أنت' : 'مرشد'}</span>
              <p>{item.text}</p>
            </article>
          ))}
          {isSending && <p className="conversation__typing" role="status">مرشد يكتب ردًا…</p>}
        </div>
      )}

      {messages.length === 0 && (
        <div className="suggestions" aria-label="أفكار للبدء">
          {suggestions.map((suggestion) => (
            <button className="suggestion-chip" key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)}>
              <SparkleIcon />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="message-draft">اكتب سؤالك أو فكرتك</label>
        <textarea
          id="message-draft"
          ref={textareaRef}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (notice) setNotice('');
          }}
          placeholder="اكتب سؤالك أو فكرتك هنا..."
          rows={2}
          maxLength={4000}
          aria-describedby="composer-status"
          disabled={isSending}
        />
        <div className="composer__toolbar">
          <div className="composer__status" id="composer-status">
            <span className={`status-dot${isConfigured ? ' status-dot--ready' : ''}`} aria-hidden="true" />
            <span>{isConfigured ? 'متصل بـGemini' : 'بانتظار إعداد مفتاح Gemini'}</span>
          </div>
          <div className="composer__actions">
            <span className="character-count" aria-live="polite">{draft.length > 0 ? `${draft.length}/4000` : 'Gemini'}</span>
            <button className="send-button" type="submit" disabled={!draft.trim() || isSending} aria-label="إرسال إلى مرشد" title="إرسال إلى مرشد">
              <SendIcon />
            </button>
          </div>
        </div>
      </form>

      {notice && <p className="composer-notice" role="status">{notice}</p>}
      <p className="privacy-note">يرسل مرشد رسائلك إلى Gemini للإجابة. لا تكتب معلومات سرية أو حساسة.</p>
    </section>
  );
}
