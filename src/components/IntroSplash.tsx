import { useCallback, useEffect, useRef, useState } from 'react';

type IntroSplashProps = {
  onComplete: () => void;
};

export default function IntroSplash({ onComplete }: IntroSplashProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setPlaybackBlocked(false);
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
      return;
    }

    void tryPlay();
    const timeoutId = window.setTimeout(onComplete, 12_000);
    return () => window.clearTimeout(timeoutId);
  }, [onComplete, tryPlay]);

  return (
    <main className="intro-screen" aria-label="مقدمة شعار مرشد">
      <div className="intro-orb intro-orb--one" aria-hidden="true" />
      <div className="intro-orb intro-orb--two" aria-hidden="true" />
      <div className="intro-screen__topline">
        <span className="intro-screen__brand">morshed_Ai</span>
        <button className="intro-skip" type="button" onClick={onComplete}>
          تخطي المقدمة
          <span aria-hidden="true">←</span>
        </button>
      </div>

      <section className="intro-card">
        <div className="intro-card__halo" aria-hidden="true" />
        <video
          ref={videoRef}
          className="intro-video"
          src="/assets/morshed-logo-intro.mp4"
          muted
          playsInline
          preload="auto"
          aria-label="فيديو شعار مرشد"
          onEnded={onComplete}
          onError={onComplete}
        />
        {playbackBlocked && (
          <button className="intro-play" type="button" onClick={() => void tryPlay()}>
            <span className="intro-play__icon" aria-hidden="true">▶</span>
            تشغيل الشعار
          </button>
        )}
      </section>

      <p className="intro-caption">بداية هادئة، وأفكار أوضح.</p>
    </main>
  );
}
