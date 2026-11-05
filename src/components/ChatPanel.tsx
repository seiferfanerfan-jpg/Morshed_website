import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import HistorySidebar, { type ConversationRecord } from './HistorySidebar';
import BrandMark from './BrandMark';
import { getAnalysisSummary, getAssistantStatus, sendToAssistant, type AssistantMessage } from '../services/assistant';

const conversationsKey = 'morshed-conversations-v1';
const timerKey = 'morshed-study-timer-v1';
const suggestions = ['اشرح لي فكرة معقدة ببساطة', 'ساعدني في كتابة رسالة واضحة', 'رتّب أفكاري في خطة عملية'];

type ActiveTimer = { deadline: number; durationMinutes: number; conversationId: string; sessionName: string };

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
    if (!parsed.conversationId || !Number.isFinite(parsed.deadline)) return null;
    return { ...parsed, sessionName: typeof parsed.sessionName === 'string' && parsed.sessionName.trim() ? parsed.sessionName : 'جلسة تركيز' };
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
  return /(مؤقّ?ت|موقت|تايمر|timer|pomodoro|(?:ال)?ب?مودورو|(?:ال)?ب?ومودورو|جلسة\s*(?:تركيز|دراسة|مذاكرة|قراءة))/iu.test(text);
}

function requestedMinutes(text: string, acceptBareNumber = false): number | null {
  const normalized = text
    .replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  if (/ربع\s*ساعة/u.test(normalized)) return 15;
  if (/(?:نص|نصف)\s*ساعة/u.test(normalized)) return 30;

  const hours = normalized.match(/(\d{1,3})\s*ساع(?:ة|ه|ات)/u);
  if (hours) return Number(hours[1]) * 60;

  const minutes = normalized.match(/(\d{1,5})\s*(?:دقيق(?:ة|ه|تين)?|دقايق|دقائق|min(?:ute)?s?)/iu);
  if (minutes) return Number(minutes[1]);

  const duration = normalized.match(/(?:مدة|لمدة|مدتها|بمدة|مؤقّ?ت|موقت|تايمر|pomodoro|مودورو|بومودورو)[^\d]{0,24}(\d{1,5})/iu);
  if (duration) return Number(duration[1]);
  if (acceptBareNumber) {
    const bareNumber = normalized.trim().match(/(?:(?:المدة|مدتها|مدة|خليها|عايزها)\s*)?(\d{1,5})\s*$/u);
    if (bareNumber) return Number(bareNumber[1]);
  }
  if (/ساعة|ستين|ستون/u.test(normalized)) return 60;
  return null;
}

function sessionNameFromReply(text: string) {
  const name = text
    .replace(/(?:ربع|نص|نصف)\s*ساعة/giu, ' ')
    .replace(/(?:لمدة|مدتها|بمدة|مدة)?\s*\d{1,5}\s*(?:دقيق(?:ة|ه|تين)?|دقايق|دقائق|min(?:ute)?s?)?/giu, ' ')
    .replace(/^(?:حاضر|تمام)[،,:：\s]*/u, '')
    .replace(/^(?:(?:اسم(?:\s+الجلسة|ها)?|اسميها|سمها|سميها|خلّي\s+اسمها|خلي\s+اسمها)\s*[:：\-]?\s*)/u, '')
    .replace(/^(?:خلي\s+المدة|المدة|مدتها|مدة|خليها|عايزها)\s*/u, '')
    .replace(/[،,:：.!؟؛\s]+$/u, '')
    .trim();
  if (!name || /^(?:خلي|المدة|مدتها|مدة|دقيقة|دقايق|دقائق)$/u.test(name)) return '';
  return name.slice(0, 64);
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
  const [timerSetupPending, setTimerSetupPending] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null);
  const [timerName, setTimerName] = useState('');
  const [timerMinutes, setTimerMinutes] = useState('');
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(loadTimer);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const copiedTimeoutRef = useRef<number | null>(null);
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
  }, [messages, isSending, analysisStatus]);

  useEffect(() => () => {
    if (copiedTimeoutRef.current !== null) window.clearTimeout(copiedTimeoutRef.current);
  }, []);

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
      const endingMessage: AssistantMessage = { role: 'model', text: `خلص وقت جلسة «${activeTimer.sessionName}». تحب نبدأ جلسة تانية؟` };
      appendToConversation(activeTimer.conversationId, [endingMessage]);
      setTimerSetupPending(false);
      setTimerName('');
      setTimerMinutes('');
      playTimerChime();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('انتهى المؤقّت', { body: `خلص وقت جلسة «${activeTimer.sessionName}». تقدر تبدأ جلسة جديدة لما تحب.` });
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

  const copyMessage = async (text: string, messageKey: string) => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      // استخدم طريقة النسخ الاحتياطية للمتصفحات التي تمنع واجهة الحافظة.
    }
    if (!copied) {
      const temporaryInput = document.createElement('textarea');
      temporaryInput.value = text;
      temporaryInput.setAttribute('readonly', '');
      temporaryInput.style.position = 'fixed';
      temporaryInput.style.opacity = '0';
      document.body.appendChild(temporaryInput);
      temporaryInput.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      temporaryInput.remove();
    }
    if (!copied) {
      setNotice('تعذّر نسخ الرسالة. حاول تاني.');
      return;
    }
    setCopiedMessageKey(messageKey);
    if (copiedTimeoutRef.current !== null) window.clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = window.setTimeout(() => setCopiedMessageKey(null), 1600);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSending) return;
    const startsQuiz = isQuizRequest(message);
    const asksForTimer = isTimerRequest(message);
    if (!isConfigured && !asksForTimer) {
      setNotice('المحادثة مش متاحة دلوقتي. جرّب تاني بعد شوية.');
      return;
    }

    const conversationId = activeId;
    const priorMessages = messages.slice(-10);
    setNotice('');
    setDraft('');
    setIsSending(true);
    setAnalysisStatus('');
    saveUserMessage(conversationId, message);

    if (asksForTimer) {
      const minutes = requestedMinutes(message);
      setTimerMinutes(minutes === null ? '' : String(minutes));
      setTimerName('');
      setTimerSetupPending(true);
      setShowTimerCard(true);
    }
    if (startsQuiz) setQuizMode(true);

    if (timerSetupPending && !asksForTimer && !startsQuiz) {
      const suppliedMinutes = requestedMinutes(message, true);
      const suppliedName = sessionNameFromReply(message);
      const nextMinutes = suppliedMinutes === null ? timerMinutes : String(suppliedMinutes);
      const nextName = suppliedName || timerName;
      if (suppliedMinutes !== null) setTimerMinutes(nextMinutes);
      if (suppliedName) setTimerName(suppliedName);

      const duration = Number(nextMinutes);
      const hasDuration = /^\d+$/.test(nextMinutes) && Number.isInteger(duration) && duration >= 1 && duration <= 1440;
      let prompt: string;
      if (suppliedMinutes !== null && !hasDuration) {
        prompt = 'المدة لازم تكون عدد صحيح من دقيقة واحدة لحد ١٤٤٠ دقيقة. اكتب الرقم تاني، أو عدّله من الكارت.';
      } else if (!nextName) {
        prompt = hasDuration ? `تمام، المدة ${duration} دقيقة. نسمي الجلسة إيه؟` : 'نسمي الجلسة إيه؟ وقولي كمان المدة بأي عدد دقائق يناسبك.';
      } else if (!hasDuration) {
        prompt = `تمام، هنسميها «${nextName}». المدة كام دقيقة؟`;
      } else {
        prompt = `تمام، جهّزت جلسة «${nextName}» لمدة ${duration} دقيقة. دوس «ابدأ الجلسة» من الكارت لما تكون جاهز.`;
      }
      appendToConversation(conversationId, [{ role: 'model', text: prompt }]);
      setTimerSetupPending(!nextName || !hasDuration);
      setIsSending(false);
      return;
    }

    if (asksForTimer && !startsQuiz) {
      appendToConversation(conversationId, [{ role: 'model', text: 'حاضر. نسمي الجلسة إيه؟ والمدة كام دقيقة؟ اكتب الاسم وأي عدد دقائق يناسبك في الكارت، وبعدها ابدأ المؤقّت.' }]);
      setIsSending(false);
      return;
    }

    try {
      const mode = startsQuiz || quizMode ? 'quiz' : 'chat';
      let analysis = '';
      if (expandedThinking) {
        setAnalysisStatus('راشد بيحلل سؤالك...');
        try {
          analysis = (await getAnalysisSummary(message, priorMessages)).slice(0, 900);
        } catch {
          analysis = '';
        }
        setAnalysisStatus('راشد بيرتّب الإجابة الموسّعة...');
      }
      const reply = await sendToAssistant(message, priorMessages, mode, expandedThinking);
      appendToConversation(conversationId, [{ role: 'model', text: reply, ...(analysis ? { analysis } : {}) }]);
    } catch (error) {
      setDraft(message);
      setNotice(error instanceof Error ? error.message : 'حصلت مشكلة مؤقتة. حاول مرة تانية.');
    } finally {
      setAnalysisStatus('');
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
    setTimerSetupPending(false);
    setTimerName('');
    setTimerMinutes('');
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
    const sessionName = timerName.trim();
    const durationMinutes = Number(timerMinutes);
    if (!sessionName) {
      setNotice('اكتب اسم الجلسة الأول.');
      return;
    }
    if (!/^\d+$/.test(timerMinutes) || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
      setNotice('اكتب مدة صحيحة من دقيقة واحدة لحد ١٤٤٠ دقيقة.');
      return;
    }
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* يظل صوت الصفحة والتنبيه المرئي متاحين */ }
    }
    const next: ActiveTimer = { deadline: Date.now() + durationMinutes * 60_000, durationMinutes, conversationId: activeId, sessionName };
    setActiveTimer(next);
    setRemainingSeconds(durationMinutes * 60);
    setNotice('');
    setTimerSetupPending(false);
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
            {messages.map((item, index) => {
              const messageKey = `${index}-${item.role}`;
              const copyText = item.analysis ? `ملخص التحليل:\n${item.analysis}\n\n${item.text}` : item.text;
              return (
                <article className={`conversation__message conversation__message--${item.role}`} key={messageKey}>
                  <div className="conversation__message-head">
                    <span className="conversation__speaker">
                      {item.role === 'user' ? 'أنت' : <><BrandMark compact markOnly /><span>راشد</span></>}
                    </span>
                    <button className="conversation__copy" type="button" onClick={() => void copyMessage(copyText, messageKey)} aria-label={copiedMessageKey === messageKey ? 'تم نسخ الرسالة' : 'نسخ الرسالة'} title={copiedMessageKey === messageKey ? 'تم النسخ' : 'نسخ'}>
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.6" /></svg>
                      <span>{copiedMessageKey === messageKey ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                  </div>
                  {item.analysis && (
                    <aside className="analysis-summary" aria-label="ملخص التحليل">
                      <div className="analysis-summary__heading"><span>ملخص التحليل</span><span>تفكير موسّع</span></div>
                      <p>{item.analysis}</p>
                    </aside>
                  )}
                  <p>{item.text}</p>
                </article>
              );
            })}
            {analysisStatus && (
              <aside className="analysis-progress" role="status" aria-live="polite">
                <span className="analysis-progress__spark" aria-hidden="true">✧</span>
                <div><strong>{analysisStatus}</strong><p>بيرتب أهم جوانب السؤال قبل الإجابة.</p></div>
              </aside>
            )}
            {isSending && !analysisStatus && <p className="conversation__typing" role="status"><BrandMark compact markOnly /><span>راشد بيرد…</span></p>}
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
          <section className="timer-card" aria-label="إعداد مؤقّت مودورو">
            <div className="timer-card__top">
              <div><p className="timer-card__eyebrow">جلسة تركيز</p><h2>{activeTimer ? `جلسة «${activeTimer.sessionName}» شغّالة` : 'سمّي الجلسة وحدد مدتها'}</h2></div>
              {activeTimer?.conversationId === activeId && <strong className="timer-card__countdown" aria-live="polite" dir="ltr">{formatTime(remainingSeconds)}</strong>}
            </div>
            {activeTimer ? <p className="timer-card__hint">المدة: {activeTimer.durationMinutes} دقيقة. هيظهر لك تنبيه وصوت لما الوقت يخلص.</p> : (
              <div className="timer-card__fields">
                <label className="timer-field" htmlFor="timer-session-name">
                  <span>نسمي الجلسة إيه؟</span>
                  <input id="timer-session-name" type="text" value={timerName} maxLength={64} placeholder="مثال: مذاكرة الرياضيات" onChange={(event) => { setTimerName(event.target.value); if (notice) setNotice(''); }} />
                </label>
                <label className="timer-field" htmlFor="timer-duration-minutes">
                  <span>المدة كام دقيقة؟</span>
                  <input id="timer-duration-minutes" type="number" min={1} max={1440} step={1} inputMode="numeric" value={timerMinutes} placeholder="اكتب أي عدد" onChange={(event) => { setTimerMinutes(event.target.value); if (notice) setNotice(''); }} />
                </label>
                <p className="timer-card__hint">اكتب أي مدة من دقيقة واحدة لحد ١٤٤٠ دقيقة.</p>
              </div>
            )}
            <div className="timer-card__actions">
              {!activeTimer && <button className="timer-start" type="button" onClick={() => void startTimer()} disabled={!timerName.trim() || !/^\d+$/.test(timerMinutes) || Number(timerMinutes) < 1 || Number(timerMinutes) > 1440}>ابدأ الجلسة</button>}
              {activeTimer && <button className="timer-close" type="button" onClick={() => { setActiveTimer(null); setTimerSetupPending(false); setTimerName(''); setTimerMinutes(''); try { window.localStorage.removeItem(timerKey); } catch { /* تجاهل */ } }}>إيقاف</button>}
              {!activeTimer && <button className="timer-close" type="button" onClick={() => { setShowTimerCard(false); setTimerSetupPending(false); }}>إخفاء</button>}
            </div>
          </section>
        )}

        {activeTimer && activeTimer.conversationId !== activeId && (
          <button className="timer-running-pill" type="button" onClick={() => { setActiveId(activeTimer.conversationId); setShowTimerCard(true); }}>جلسة «{activeTimer.sessionName}» شغّالة · {formatTime(remainingSeconds)}</button>
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
              <button className={`thinking-toggle${expandedThinking ? ' thinking-toggle--active' : ''}`} type="button" onClick={() => setExpandedThinking((enabled) => !enabled)} aria-pressed={expandedThinking} title="يعرض ملخص التحليل والخطوات العامة، وليس التفكير الداخلي الحرفي">
                <span className="thinking-toggle__icon" aria-hidden="true">✧</span><span>تفكير موسّع</span>
              </button>
              <button className={`timer-toolbar-button${showTimerCard ? ' timer-toolbar-button--active' : ''}`} type="button" onClick={() => setShowTimerCard((visible) => !visible)} aria-label="إظهار المؤقّت"><span aria-hidden="true">◷</span> مؤقّت</button>
              <span className="character-count" aria-live="polite">{draft.length > 0 ? `${draft.length}/4000` : 'راشد'}</span>
              <button className="send-button" type="submit" disabled={!draft.trim() || isSending} aria-label="إرسال إلى راشد" title="إرسال إلى راشد"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5m0 0L6 11m6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
            </div>
          </div>
          {expandedThinking && <p className="analysis-mode-note" id="analysis-mode-note">هعرض ملخص التحليل والنتيجة، مش التفكير الداخلي الحرفي.</p>}
        </form>

        {notice && <p className="composer-notice" role="status">{notice}</p>}
        <p className="privacy-note">لو المعلومة مهمة، راجعها من مصدر موثوق.</p>
      </section>
    </div>
  );
}
