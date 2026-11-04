import { useCallback, useState } from 'react';
import BrandMark from './components/BrandMark';
import ChatPanel from './components/ChatPanel';
import IntroSplash from './components/IntroSplash';

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [introLeaving, setIntroLeaving] = useState(false);
  const completeIntro = useCallback(() => setShowIntro(false), []);
  const beginAppReveal = useCallback(() => setIntroLeaving(true), []);
  const appIsCovered = showIntro && !introLeaving;
  const appClassName = `app-shell${appIsCovered ? ' app-shell--covered' : ''}${introLeaving || !showIntro ? ' app-shell--entering' : ''}`;

  return (
    <>
      <main className={appClassName} id="home" aria-hidden={showIntro} inert={showIntro}>
        <div className="ambient ambient--lavender" aria-hidden="true" />
        <div className="ambient ambient--blue" aria-hidden="true" />

        <header className="topbar">
          <BrandMark />
          <div className="topbar__right">
            <span className="beta-pill"><span className="beta-pill__dot" />نسخة أولية</span>
            <button className="profile-button" type="button" aria-label="حساب مرشد" title="حساب مرشد">
              م
            </button>
          </div>
        </header>

        <div className="workspace">
          <div className="workspace__rule" aria-hidden="true" />
          <ChatPanel />
        </div>

        <footer className="app-footer">
          <span>morshed_Ai</span>
          <span className="footer-separator" aria-hidden="true">·</span>
          <span>مساعدك باللغة العربية</span>
        </footer>
      </main>

      {showIntro && <IntroSplash onLeaving={beginAppReveal} onComplete={completeIntro} />}
    </>
  );
}
