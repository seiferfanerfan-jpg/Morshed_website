type BrandMarkProps = {
  compact?: boolean;
};

export default function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <a className={`brand-mark${compact ? ' brand-mark--compact' : ''}`} href="#home" aria-label="مرشد، الصفحة الرئيسية">
      <span className="brand-mark__symbol" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path d="M10.5 28.5c3.2-8.4 7-13.1 11.5-13.1 4.1 0 6.8 3.6 7.5 8.1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M8.5 25.5c3.7 2.5 7.6 3.8 11.6 3.8 4.1 0 7.8-1.2 11.2-3.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="29.5" cy="12.5" r="3.5" fill="currentColor" />
          <path d="M29.5 7.2V5M35 12.5h2.2M24 12.5h-2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <span className="brand-mark__wording">
        <span className="brand-mark__name">مرشد</span>
        {!compact && <span className="brand-mark__subname">morshed_Ai</span>}
      </span>
    </a>
  );
}
