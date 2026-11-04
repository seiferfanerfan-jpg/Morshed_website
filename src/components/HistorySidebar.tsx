import { useState } from 'react';
import type { AssistantMessage } from '../services/assistant';

export type ConversationRecord = {
  id: string;
  title: string;
  updatedAt: number;
  pinned: boolean;
  messages: AssistantMessage[];
};

type HistorySidebarProps = {
  items: ConversationRecord[];
  activeId: string;
  onOpen: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
};

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(new Date(timestamp));
}

function findMatch(item: ConversationRecord, query: string) {
  const needle = query.trim().toLocaleLowerCase('ar');
  if (!needle) return true;
  return item.title.toLocaleLowerCase('ar').includes(needle)
    || item.messages.some((message) => message.text.toLocaleLowerCase('ar').includes(needle));
}

export default function HistorySidebar({ items, activeId, onOpen, onPin, onDelete, onNew, onClose }: HistorySidebarProps) {
  const [query, setQuery] = useState('');
  const filtered = items.filter((item) => findMatch(item, query));

  return (
    <aside className="history-sidebar" aria-label="المحادثات والمهام">
      <div className="history-sidebar__heading">
        <div>
          <p className="history-sidebar__eyebrow">مساحتك مع راشد</p>
          <h2>المحادثات والمهام</h2>
        </div>
        <button className="icon-button history-sidebar__close" type="button" onClick={onClose} aria-label="إغلاق سجل المحادثات">×</button>
      </div>

      <button className="history-new" type="button" onClick={onNew}>
        <span aria-hidden="true">＋</span>
        <span>محادثة جديدة</span>
      </button>

      <label className="history-search">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في محادثاتك..." aria-label="ابحث في المهام والمحادثات" />
      </label>

      <div className="history-list" aria-live="polite">
        {filtered.length === 0 ? (
          <p className="history-empty">مفيش محادثات مطابقة لبحثك.</p>
        ) : filtered.map((item) => (
          <article className={`history-item${activeId === item.id ? ' history-item--active' : ''}`} key={item.id}>
            <button className="history-item__open" type="button" onClick={() => onOpen(item.id)} aria-current={activeId === item.id ? 'page' : undefined}>
              <span className="history-item__icon" aria-hidden="true">{item.pinned ? '◆' : '◌'}</span>
              <span className="history-item__text">
                <strong>{item.title || 'محادثة جديدة'}</strong>
                <small>{item.messages.length ? `${item.messages.filter((message) => message.role === 'user').length} رسائل · ${formatDate(item.updatedAt)}` : `لسه مفيش رسائل · ${formatDate(item.updatedAt)}`}</small>
              </span>
            </button>
            <div className="history-item__actions">
              <button className="icon-button" type="button" onClick={() => onPin(item.id)} aria-label={item.pinned ? 'إلغاء تثبيت المحادثة' : 'تثبيت المحادثة'} title={item.pinned ? 'إلغاء التثبيت' : 'تثبيت'}>{item.pinned ? '★' : '☆'}</button>
              <button className="icon-button icon-button--danger" type="button" onClick={() => onDelete(item.id)} aria-label="حذف المحادثة" title="حذف">×</button>
            </div>
          </article>
        ))}
      </div>

      <section className="coming-soon" aria-label="مزايا قادمة">
        <div className="coming-soon__heading">
          <span>مزايا قادمة</span>
          <span className="coming-soon__lock" aria-hidden="true">⌑</span>
        </div>
        <div className="coming-soon__grid">
          <div className="coming-soon__card" aria-disabled="true"><span aria-hidden="true">◷</span><strong>المحاضرات</strong><small>قريبًا</small></div>
          <div className="coming-soon__card" aria-disabled="true"><span aria-hidden="true">▦</span><strong>الاجتماعات</strong><small>قريبًا</small></div>
        </div>
        <div className="coming-soon__other" aria-disabled="true"><span aria-hidden="true">⌑</span><span>مهام أخرى</span><small>قريبًا</small></div>
        <p>المزايا دي لسه قيد التطوير.</p>
      </section>
    </aside>
  );
}
