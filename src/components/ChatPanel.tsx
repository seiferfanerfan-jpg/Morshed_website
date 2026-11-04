import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import HistorySidebar, { type ConversationRecord } from './HistorySidebar';
import BrandMark from './BrandMark';
import { getAssistantStatus, sendToAssistant, type AssistantMessage } from '../services/assistant';

const conversationsKey = 'morshed-conversations-v1';
const timerKey = 'morshed-study-timer-v1';
const timerOptions = [8, 45, 60];
const suggestions = ['اشرح لي فكرة معقدة ببساطة', 'ساعدني في كتابة رسالة واضحة', 'رتّب أفكاري في خطة عملية'];

type ActiveTimer = { deadline: number; durationMinutes: number; conversationId: string };

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function blankConversation(id: string = newId()): ConversationRecord {
  return { id, title: 'محادثة جديدة', updatedAt: Date.now(), pinned: false, messages: [] };
}

function loadConversations(): ConversationRecord[] {
  try {
    const value = window.localStorage.getItem(conversationsKey);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ConversationRecord => Boolean(
      item && typeof item.id === 'string' && typeof item.title === 'string'
      && typeof item.updatedAt === 'number' && typeof item.pinned === 'boolean'
      && Array.isArray(item.messages)
      && item.messages.every((message: AssistantMessage) => message && ['user', 'model'].includes(message.role) && typeof message.text === 'string'),
    ));
  } catch {
    return [];
  }
}

function loadTimer(): ActiveTimer | null {
  try {
    const value = window.localStorage.getItem(timerKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as ActiveTimer;
    return parsed.conversationId && Number.isFinite(parsed.deadline) ? parsed : null;
  } catch {
    return null;
  }
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function isQuizRequest(text: string) {
  return /(اختبرني|امتحنني|يلا\s*اختبار|جلسة\s*اختبار)/u.test(text);
}

function isTimerRequest(text: string) {
  return /(مؤقّت|مؤقت|تايمر)/u.test(text);
}

function requestedMinutes(text: string) {
  const normalized = text.replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  if (/60\s*(دقيق|دقايق|دقيقة)|ساعة|ستين|ستون/u.test(normalized)) return 60;
  if (/45\s*(دقيق|دقايق|دقيقة)|خمسة\s*وأربعين|خمسه\s*واربعين/u.test(normalized)) return 45;
  if (/8\s*(دقيق|دقايق|دقيقة)|ثمانية|تمانية/u.test(normalized)) return 8;
  return 8;
}

function playTimerChime() {
  try {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.setValueAtTime(560, context.currentTime + 0.22);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.75);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.8);
    oscillator.onended = () => void context.close();
  } catch {
    // صوت التنبيه تحسين اختياري؛ يظل إشعار الصفحة ظاهرًا لو تعذّر تشغيله.
  }
}

export default function ChatPanel() {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [sessions, setSessions] = useState<ConversationRecord[]>(loadConversations);
  const [activeId, setActiveId] = useState(() => loadConversations()[0]?.id ?? newId());
  const [isConfigured, setIsConfigured] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [showTimerCard, setShowTimerCard] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(8);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(loadTimer);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const currentConversation = sessions.find((conversation) => conversation.id === activeId);
  const messages = currentConversation?.messages ?? [];
  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt), [sessions]);

  useEffect(() => {
    void getAssistantStatus().then(setIsConfigured);
  }, []);

  useEffect(() => {
    if (!sessions.some((conversation) => conversation.id === activeId)) {
      setSessions((current) => [blankConversation(activeId), ...current]);
    }
  }, [activeId, sessions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(conversationsKey, JSON.stringify(sessions));
    } catch {
      setNotice('تعذّر حفظ السجل على الجهاز. ممكن تكون مساحة المتصفح ممتلئة.');
    }
  }, [sessions]);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  const appendToConversation = useCallback((conversationId: string, additions: AssistantMessage[]) => {
    setSessions((current) => current.map((conversation) => conversation.id === conversationId
      ? { ...conversation, messages: [...conversation.messages, ...additions], updatedAt: Date.now() }
      : conversation));
  }, []);

  const saveUserMessage = useCallback((conversationId: string, text: string) => {
    setSessions((current) => current.map((conversation) => {
      if (conversation.id !== conversationId) return conversation;
      const title = conversation.messages.length === 0 ? text.slice(0, 42).trim() || 'محادثة جديدة' : conversation.title;
      return { ...conversation, title, messages: [...conversation.messages, { role: 'user', text }], updatedAt: Date.now() };
    }));
  }, []);

  useEffect(() => {
    if (!activeTimer) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((activeTimer.deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining > 0) return;

      setActiveTimer(null);
      try { window.localStorage.removeItem(timerKey); } catch { /* تجاهل تعذّر التخزين */ }
      const endingMessage: AssistantMessage = { role: 'model', text: 'خلص وقت الجلسة. تحب نبدأ جلسة تانية؟' };
      appendToConversation(activeTimer.conversationId, [endingMessage]);
      playTimerChime();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('انتهى المؤقّت', { body: 'خلص وقت الجلسة. تقدر تبدأ جلسة جديدة لما تحب.' });
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer, appendToConversation]);

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
      setNotice('المحادثة مش متاحة دلوقتي. جرّب تاني بعد شوية.');
      return;
    }

    const conversationId = activeId;
    const priorMessages = messages.slice(-10);
    const startsQuiz = isQuizRequest(message);
    const asksForTimer = isTimerRequest(message);
    setNotice('');
    setDraft('');
    setIsSending(true);
    saveUserMessage(conversationId, message);

    if (asksForTimer) {
      setTimerMinutes(requestedMinutes(message));
      setShowTimerCard(true);
    }
    if (startsQuiz) setQuizMode(true);

    if (asksForTimer && !startsQuiz) {
      appendToConversation(conversationId, [{ role: 'model', text: 'حاضر، اختار مدة المؤقّت من الكارت اللي ظاهر قدامك، ولما تكون جاهز دوس «ابدأ المؤقّت».' }]);
      setIsSending(false);
      return;
    }

    try {
      const reply = await sendToAssistant(message, priorMessages, startsQuiz || quizMode ? 'quiz' : 'chat');
      appendToConversation(conversationId, [{ role: 'model', text: reply }]);
    } catch (error) {
      setDraft(message);
      setNotice(error instanceof Error ? error.message : 'حصلت مشكلة مؤقتة. حاول مرة تانية.');
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const createConversation = () => {
    const fresh = blankConversation();
    setSessions((current) => [fresh, ...current]);
    setActiveId(fresh.id);
    setQuizMode(false);
    setShowTimerCard(false);
    setHistoryOpen(false);
    setNotice('');
  };

  const togglePin = (conversationId: string) => {
    setSessions((current) => current.map((conversation) => conversation.id === conversationId
      ? { ...conversation, pinned: !conversation.pinned, updatedAt: Date.now() }
      : conversation));
  };

  const deleteConversation = (conversationId: string) => {
    const remaining = sessions.filter((conversation) => conversation.id !== conversationId);
    if (activeTimer?.conversationId === conversationId) {
      setActiveTimer(null);
      try { window.localStorage.removeItem(timerKey); } catch { /* تجاهل تعذّر التخزين */ }
    }
    setSessions(remaining);
    if (conversationId === activeId) {
      const next = remaining[0] ?? blankConversation();
      setSessions(remaining.length ? remaining : [next]);
      setActiveId(next.id);
      setQuizMode(false);
    }
  };

  const startTimer = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* يظل صوت الصفحة والتنبيه المرئي متاحين */ }
    }
    const next: ActiveTimer = { deadline: Date.now() + timerMinutes * 60_000, durationMinutes: timerMinutes, conversationId: activeId };
    setActiveTimer(next);
    setRemainingSeconds(timerMinutes * 60);
    try { window.localStorage.setItem(timerKey, JSON.stringify(next)); } catch { /* يبقى المؤقّت فعالًا للجلسة الحالية */ }
    setShowTimerCard(true);
  };

  return (
    <div className={`chat-layout${historyOpen ? ' chat-layout--history-open' : ''}`}>
      <HistorySidebar
        items={sortedSessions}
        activeId={activeId}
        onOpen={(id) => { setActiveId(id); setHistoryOpen(false); setQuizMode(false); }}
        onPin={togglePin}
        onDelete={deleteConversation}
        onNew={createConversation}
        onClose={() => setHistoryOpen(false)}
      />

      <section className="chat-panel" aria-labelledby="welcome-title">
        <div className="chat-heading">
          <button className="history-toggle" type="button" onClick={() => setHistoryOpen((open) => !open)} aria-expanded={historyOpen}>
            <span aria-hidden="true">☷</span> المحادثات
          </button>
          <p className="chat-heading__title">{currentConversation?.title || 'محادثة جديدة'}</p>
          <button className="new-chat-button" type="button" onClick={createConversation}><span aria-hidden="true">＋</span> جديد</button>
        </div>

        {messages.length === 0 && (
          <>
            <div className="chat-panel__welcome">
              <span className="assistant-orbit" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m12 3 1.65 5.35L19 10l-5.35 1.65L12 17l-1.65-5.35L5 10l5.35-1.65L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" fill="currentColor" /></svg></span>
              <p className="eyebrow">نموذج فرعي من مرشد AI</p>
              <h1 id="welcome-title">أهلًا، أنا <span>راشد</span></h1>
              <p className="welcome-copy">مساعدك في الكلام والأفكار، وأنا جزء من تطبيق مرشد.</p>
            </div>
            <aside className="assistant-about" aria-label="عن راشد ومرشد AI">
              <p><strong>أنا راشد:</strong> للتجربة الحوارية ومساعدتك في أسئلتك وأفكارك. ممكن أغلط، فراجع ورايا في المعلومات المهمة.</p>
              <p><strong>مرشد AI داخل التطبيق:</strong> للتنبيهات والتذكيرات والتكامل مع التطبيق. تسجيل المحاضرات وتدوينها وتلخيصها، ودعم الصور والملفات والتسجيلات الصوتية، لسه قيد التطوير.</p>
              <p className="assistant-about__origin">طوّر التطبيق فريق مرشد AI بقيادة سيف عرفان، واتعملت فكرته بمحبة بين سيف وحبيبته.</p>
            </aside>
            <div className="suggestions" aria-label="أفكار للبدء">
              {suggestions.map((suggestion) => <button className="suggestion-chip" key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)}><span aria-hidden="true">✧</span><span>{suggestion}</span></button>)}
            </div>
          </>
        )}

        {messages.length > 0 && (
          <div className="conversation" ref={conversationRef} aria-live="polite" aria-label="المحادثة">
            {messages.map((item, index) => (
              <article className={`conversation__message conversation__message--${item.role}`} key={`${index}-${item.role}`}>
                <span className="conversation__speaker">
                  {item.role === 'user' ? 'أنت' : <><BrandMark compact markOnly /><span>راشد</span></>}
                </span>
                <p>{item.text}</p>
              </article>
            ))}
            {isSending && <p className="conversation__typing" role="status"><BrandMark compact markOnly /><span>راشد بيرد…</span></p>}
          </div>
        )}

        {quizMode && (
          <div className="quiz-banner" role="status">
            <span className="quiz-banner__dot" aria-hidden="true" />
            <span>وضع الاختبار شغّال — سؤال واحد كل مرة وبالراحة</span>
            <button type="button" onClick={() => setQuizMode(false)}>إنهاء الاختبار</button>
          </div>
        )}

        {showTimerCard && (!activeTimer || activeTimer.conversationId === activeId) && (
          <section className="timer-card" aria-label="اختيار مدة المؤقّت">
            <div className="timer-card__top">
              <div><p className="timer-card__eyebrow">جلسة تركيز</p><h2>{activeTimer ? 'المؤقّت شغّال' : 'اختار مدة المؤقّت'}</h2></div>
              {activeTimer?.conversationId === activeId && <strong className="timer-card__countdown" aria-live="polite" dir="ltr">{formatTime(remainingSeconds)}</strong>}
            </div>
            <div className="timer-options">
              {timerOptions.map((minutes) => (
                <button className={`timer-option${timerMinutes === minutes ? ' timer-option--selected' : ''}`} type="button" key={minutes} onClick={() => setTimerMinutes(minutes)} disabled={Boolean(activeTimer)}>
                  <strong>{minutes}</strong><span>دقيقة</span>
                </button>
              ))}
            </div>
            <div className="timer-card__actions">
              {activeTimer ? <span className="timer-card__hint">هيظهر لك تنبيه وصوت لما الوقت يخلص.</span> : <button className="timer-start" type="button" onClick={() => void startTimer()}>ابدأ المؤقّت</button>}
              {activeTimer && <button className="timer-close" type="button" onClick={() => { setActiveTimer(null); try { window.localStorage.removeItem(timerKey); } catch { /* تجاهل */ } }}>إيقاف</button>}
              {!activeTimer && <button className="timer-close" type="button" onClick={() => setShowTimerCard(false)}>إخفاء</button>}
            </div>
          </section>
        )}

        {activeTimer && activeTimer.conversationId !== activeId && (
          <button className="timer-running-pill" type="button" onClick={() => { setActiveId(activeTimer.conversationId); setShowTimerCard(true); }}>فيه مؤقّت شغّال · {formatTime(remainingSeconds)}</button>
        )}

        <form className="composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="message-draft">اكتب سؤالك أو فكرتك</label>
          <textarea
            id="message-draft"
            ref={textareaRef}
            value={draft}
            onChange={(event) => { setDraft(event.target.value); if (notice) setNotice(''); }}
            placeholder="اكتب سؤالك أو فكرتك هنا..."
            rows={2}
            maxLength={4000}
            aria-describedby="composer-status"
            disabled={isSending}
          />
          <div className="composer__toolbar">
            <div className="composer__status" id="composer-status"><span className={`status-dot${isConfigured ? ' status-dot--ready' : ''}`} aria-hidden="true" /><span>{isConfigured ? 'راشد جاهز للمحادثة' : 'المحادثة غير متاحة حاليًا'}</span></div>
            <div className="composer__actions">
              <button className={`timer-toolbar-button${showTimerCard ? ' timer-toolbar-button--active' : ''}`} type="button" onClick={() => setShowTimerCard((visible) => !visible)} aria-label="إظهار المؤقّت"><span aria-hidden="true">◷</span> مؤقّت</button>
              <span className="character-count" aria-live="polite">{draft.length > 0 ? `${draft.length}/4000` : 'راشد'}</span>
              <button className="send-button" type="submit" disabled={!draft.trim() || isSending} aria-label="إرسال إلى راشد" title="إرسال إلى راشد"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5m0 0L6 11m6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
            </div>
          </div>
        </form>

        {notice && <p className="composer-notice" role="status">{notice}</p>}
        <p className="privacy-note">لو المعلومة مهمة، راجعها من مصدر موثوق.</p>
      </section>
    </div>
  );
}
