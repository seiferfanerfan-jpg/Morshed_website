import { useRef, useState, type FormEvent } from 'react';
import { assistantStatus } from '../services/assistant';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isReady = assistantStatus !== 'not-configured';

  const chooseSuggestion = (text: string) => {
    setDraft(text);
    setNotice('');
    textareaRef.current?.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) return;

    if (!isReady) {
      setNotice('واجهة مرشد جاهزة. سيتم تفعيل إرسال الأسئلة بعد ربط API التشغيل.');
      return;
    }

    setNotice('');
  };

  return (
    <section className="chat-panel" aria-labelledby="welcome-title">
      <div className="chat-panel__welcome">
        <span className="assistant-orbit" aria-hidden="true"><SparkleIcon /></span>
        <p className="eyebrow">مساحة مرشد</p>
        <h1 id="welcome-title">أهلًا، أنا <span>مرشد</span></h1>
        <p className="welcome-copy">ما الفكرة التي تحب أن نبدأ بها اليوم؟</p>
      </div>

      <div className="suggestions" aria-label="أفكار للبدء">
        {suggestions.map((suggestion) => (
          <button className="suggestion-chip" key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)}>
            <SparkleIcon />
            <span>{suggestion}</span>
          </button>
        ))}
      </div>

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
        />
        <div className="composer__toolbar">
          <div className="composer__status" id="composer-status">
            <span className="status-dot" aria-hidden="true" />
            <span>سيُفعّل الرد بعد ربط الخدمة</span>
          </div>
          <div className="composer__actions">
            <span className="character-count" aria-live="polite">{draft.length > 0 ? `${draft.length}/4000` : 'مرشد AI'}</span>
            <button className="send-button" type="submit" disabled={!draft.trim()} aria-label="إرسال إلى مرشد" title="إرسال إلى مرشد">
              <SendIcon />
            </button>
          </div>
        </div>
      </form>

      {notice && <p className="composer-notice" role="status">{notice}</p>}
      <p className="privacy-note">لن تُرسل رسالتك إلى أي مكان قبل تفعيل اتصال مرشد.</p>
    </section>
  );
}
