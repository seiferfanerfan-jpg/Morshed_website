import { useCallback, useEffect, useRef, useState } from 'react';
import BrandMark from './BrandMark';

type IntroSplashProps = {
  onComplete: () => void;
  onLeaving: () => void;
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 6 9 6-9 6V6Z" fill="currentColor" />
    </svg>
  );
}

function formatTime(seconds: number) {
  return `00:${Math.floor(seconds).toString().padStart(2, '0')}`;
}

export default function IntroSplash({ onComplete, onLeaving }: IntroSplashProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isLeavingRef = useRef(false);
  const exitTimerRef = useRef<number | undefined>(undefined);
  const [isLeaving, setIsLeaving] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const enterApp = useCallback(() => {
    if (isLeavingRef.current) return;

    isLeavingRef.current = true;
    setIsLeaving(true);
    onLeaving();
    exitTimerRef.current = window.setTimeout(onComplete, 560);
  }, [onComplete, onLeaving]);

  const playVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setPlaybackBlocked(false);
      setVideoUnavailable(false);
    } catch {
      setPlaybackBlocked(true);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setPlaybackBlocked(true);
      const reducedMotionTimer = window.setTimeout(enterApp, 4_200);
      return () => window.clearTimeout(reducedMotionTimer);
    }

    void playVideo();
    const fallbackTimer = window.setTimeout(enterApp, 8_500);
    return () => window.clearTimeout(fallbackTimer);
  }, [enterApp, playVideo]);

  useEffect(() => () => {
    if (exitTimerRef.current !== undefined) window.clearTimeout(exitTimerRef.current);
  }, []);

  const updateProgress = (video: HTMLVideoElement) => {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3;
    setProgress(Math.min(100, Math.max(0, (video.currentTime / duration) * 100)));
    setElapsed(video.currentTime);
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') enterApp();
  }, [enterApp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <main className={`intro-premium${isLeaving ? ' intro-premium--leaving' : ''}`} aria-label="مقدمة مرشد" dir="rtl">
      <div className="intro-premium__texture" aria-hidden="true" />
      <div className="intro-premium__glow intro-premium__glow--violet" aria-hidden="true" />
      <div className="intro-premium__glow intro-premium__glow--blue" aria-hidden="true" />

      <header className="intro-premium__header">
        <BrandMark />
        <div className="intro-premium__header-actions">
          <span className="intro-premium__label"><span />مقدمة مرشد</span>
          <button className="intro-premium__skip" type="button" onClick={enterApp}>
            <span>تخطي</span>
            <span className="intro-premium__skip-key" aria-hidden="true">ESC</span>
          </button>
        </div>
      </header>

      <section className="intro-showcase" aria-labelledby="intro-title">
        <div className="intro-copy">
          <p className="intro-copy__eyebrow"><span>01</span> مساحة مرشد</p>
          <h1 id="intro-title" className="intro-copy__title">
            فكرتك تبدأ<br />
            <span>بسؤال.</span>
          </h1>
          <p className="intro-copy__body">
            بداية هادئة، وأفكار أوضح.
            <br />
            تعرّف على مساحة مرشد الجديدة.
          </p>
          <div className="intro-copy__rule" aria-hidden="true"><span /></div>
          <button className="intro-enter" type="button" onClick={enterApp}>
            <span>ادخل إلى مرشد</span>
            <ArrowIcon />
          </button>
          <p className="intro-copy__hint"><span aria-hidden="true">●</span> مقدمة قصيرة · يمكنك الدخول الآن</p>
        </div>

        <div className="intro-media-column">
          <div className="intro-media-column__aura" aria-hidden="true" />
          <section className="intro-media-card" aria-label="فيديو شعار مرشد">
            <div className="intro-media-card__chrome">
              <div className="intro-media-card__identity">
                <span className="intro-media-card__indicator" aria-hidden="true" />
                <span>شعار مرشد</span>
              </div>
              <span className="intro-media-card__time" dir="ltr">{formatTime(elapsed)} / 00:03</span>
            </div>

            <div className="intro-media-card__screen">
              <video
                ref={videoRef}
                className="intro-premium__video"
                src="/assets/morshed-logo-intro.mp4"
                poster="/assets/morshed-logo-poster.webp"
                muted
                playsInline
                preload="auto"
                aria-label="مقدمة فيديو شعار مرشد"
                onTimeUpdate={(event) => updateProgress(event.currentTarget)}
                onEnded={() => {
                  setProgress(100);
                  setElapsed(3);
                  enterApp();
                }}
                onError={() => {
                  setVideoUnavailable(true);
                  setPlaybackBlocked(true);
                }}
              />

              {playbackBlocked && !videoUnavailable && (
                <div className="intro-video-overlay">
                  <button className="intro-video-overlay__button" type="button" onClick={() => void playVideo()}>
                    <span className="intro-video-overlay__play"><PlayIcon /></span>
                    <span>شاهد مقدمة مرشد</span>
                  </button>
                </div>
              )}

              {videoUnavailable && (
                <div className="intro-video-overlay intro-video-overlay--error">
                  <p>تعذّر تشغيل فيديو المقدمة</p>
                  <button type="button" onClick={enterApp}>ادخل إلى مرشد</button>
                </div>
              )}
            </div>

            <div className="intro-media-card__footer">
              <div className="intro-media-card__footer-copy">
                <span>بداية هادئة، وأفكار أوضح</span>
                <span className="intro-media-card__caption">SEIFAi</span>
              </div>
              <div
                className="intro-progress"
                role="progressbar"
                aria-label="تقدم فيديو المقدمة"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                aria-valuetext={`${Math.floor(elapsed)} من 3 ثوانٍ`}
              >
                <span style={{ transform: `scaleX(${progress / 100})` }} />
              </div>
            </div>
          </section>

          <div className="intro-media-note">
            <span className="intro-media-note__mark" aria-hidden="true">م</span>
            <span>مساعدك باللغة العربية</span>
            <span className="intro-media-note__separator" aria-hidden="true" />
            <span>مساحة مرشد</span>
          </div>
        </div>
      </section>

      <footer className="intro-premium__footer">
        <span className="intro-premium__footer-brand">SEIFAi</span>
        <span className="intro-premium__footer-line" aria-hidden="true" />
        <span>ابدأ بما يدور في بالك</span>
      </footer>
    </main>
  );
}
