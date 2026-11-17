import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { dailyStore, STORAGE_KEY, untilMidnight } from './lib/daily';
import type { Fortune } from './data/fortunes';
import FallbackScene from './ui/FallbackScene';
import { CookieTarget } from './ui/CookieTarget';
import { CookieIllustration } from './ui/CookieIllustration';
import type { SceneProps } from './scene/FortuneScene';

const FortuneScene = lazy(() => import('./scene/FortuneScene'));

function usePreference(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const change = () => setMatches(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [query]);
  return matches;
}

function supportsWebGL() {
  if (new URLSearchParams(window.location.search).has('fallback')) return false;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Star({ className = '' }: { className?: string }) {
  return <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2c0 7-3 10-10 10 7 0 10 3 10 10 0-7 3-10 10-10-7 0-10-3-10-10Z" stroke="currentColor" strokeWidth="1.1"/></svg>;
}

export function App() {
  const [fortune, setFortune] = useState<Fortune | null>(() => dailyStore.today());
  const [phase, setPhase] = useState<SceneProps['phase']>(() => fortune ? 'revealed' : 'idle');
  const [selected, setSelected] = useState(5);
  const [webgl, setWebgl] = useState(supportsWebGL);
  const [visible, setVisible] = useState(!document.hidden);
  const [persistent, setPersistent] = useState(dailyStore.persistent);
  const [hovered, setHovered] = useState<number | null>(null);
  const targets = useRef<(HTMLDivElement | null)[]>([]);
  const [copied, setCopied] = useState(false);
  const reducedMotion = usePreference('(prefers-reduced-motion: reduce)');
  const busy = useRef(false);
  const activePhase = useRef(phase);
  const paper = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  activePhase.current = phase;

  const onCookieLayout = useCallback((index: number, x: number, y: number, width: number) => {
    const style = targets.current[index]?.style;
    if (!style) return;
    style.transform = `translate3d(${x}px, ${y}px, 0)`;
    style.setProperty('--target-width', `${Math.max(52, width)}px`);
    style.setProperty('--target-height', `${Math.max(44, width * 0.75)}px`);
  }, []);
  const onPaperLayout = useCallback((x: number, y: number, width: number, height: number) => {
    const style = reveal.current?.style;
    if (!style) return;
    style.setProperty('--paper-x', `${x}px`);
    style.setProperty('--paper-y', `${y}px`);
    style.setProperty('--paper-width', `${width}px`);
    style.setProperty('--paper-height', `${height}px`);
  }, []);
  const onFailure = useCallback(() => {
    reveal.current?.removeAttribute('style');
    setWebgl(false);
  }, []);
  const onReveal = useCallback(() => {
    busy.current = false;
    setPhase('revealed');
  }, []);

  const choose = useCallback(async (index: number) => {
    if (busy.current) return;
    if (activePhase.current === 'revealed') {
      paper.current?.focus({ preventScroll: true });
      return;
    }
    busy.current = true;
    try {
      const draw = await dailyStore.reserveExclusive();
      setFortune(draw);
      setPersistent(dailyStore.persistent);
      setSelected(index);
      setPhase('opening');
    } catch {
      // A denied Web Locks permission must not prevent the ordinary daily draw.
      const draw = dailyStore.reserve();
      setFortune(draw);
      setPersistent(dailyStore.persistent);
      setSelected(index);
      setPhase('opening');
    }
  }, []);

  useEffect(() => {
    let timeout: number;
    function sync() {
      const draw = dailyStore.today();
      setPersistent(dailyStore.persistent);
      if (draw) {
        setFortune(draw);
        if (activePhase.current !== 'opening') setPhase('revealed');
      } else {
        busy.current = false;
        setFortune(null);
        setPhase('idle');
      }
      clearTimeout(timeout);
      timeout = window.setTimeout(sync, untilMidnight() + 100);
    }
    function storageChanged(event: StorageEvent) {
      if (event.key === STORAGE_KEY || event.key === null) sync();
    }
    function visibilityChanged() { setVisible(!document.hidden); if (!document.hidden) sync(); }
    timeout = window.setTimeout(sync, untilMidnight() + 100);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'revealed') return;
    // Transfer keyboard focus once the printed message is ready to read.
    const timer = window.setTimeout(() => paper.current?.focus({ preventScroll: true }), 80);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const sceneProps: SceneProps = { phase, selected, reducedMotion, visible, onChoose: choose, onReveal, onFailure, onPaperLayout, onCookieLayout, hovered };
  const date = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' }).format(new Date());
  const revealed = phase === 'revealed';
  async function copyFortune() {
    if (!fortune) return;
    try {
      await navigator.clipboard.writeText(fortune.text);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      const element = document.querySelector('.fortune-text');
      if (selection && element) { range.selectNodeContents(element); selection.removeAllRanges(); selection.addRange(range); }
    }
  }

  return <div className={`app app--${phase}${reducedMotion ? ' reduced-motion' : ''}`}>
    <header className="site-header">
      <a className="brand" href={import.meta.env.BASE_URL} aria-label="Fortune Cookies home">
        <span className="brand-mark"><CookieIllustration /></span>
        <span>fortune cookies<span className="brand-dot">.</span></span>
      </a>
      <div className="daily-badge"><span className="sun-icon" aria-hidden="true">☼</span><span>A LITTLE WONDER, ONCE A DAY</span></div>
    </header>

    <main>
      <div className="intro">
        <div className="eyebrow"><span className="eyebrow-line"/> A SMALL RITUAL. A LITTLE POSSIBILITY. <span className="eyebrow-line"/></div>
        <h1>{phase === 'idle' ? <>Good things are<br/><em>on their way.</em><Star className="title-star"/></> : <>A little hope,<br/><em>just for you.</em><Star className="title-star"/></>}</h1>
        <p className="intro-description">{phase === 'idle' ? 'Follow your curiosity. See what’s inside.' : 'A few words to carry into your day.'}</p>
      </div>

      <section className="cookie-stage" aria-label="Choose from ten floating fortune cookies" aria-busy={phase === 'opening'}>
        <span className="scene-spark scene-spark--one" aria-hidden="true">✧</span>
        <span className="scene-spark scene-spark--two" aria-hidden="true">+</span>
        <span className="scene-spark scene-spark--three" aria-hidden="true">✧</span>
        <div className="scene-canvas">
          {webgl ? <SceneBoundary onFailure={onFailure} fallback={<FallbackScene {...sceneProps} />}>
            <Suspense fallback={<div className="scene-loading" role="status">Gathering a little wonder<span>· · ·</span></div>}>
              <FortuneScene {...sceneProps} />
            </Suspense>
          </SceneBoundary> : <FallbackScene {...sceneProps} />}
        </div>
        {webgl && <div className="cookie-target-layer">{Array.from({ length: 10 }, (_, index) => <div
          className="projected-cookie" key={index} ref={(element) => { targets.current[index] = element; }}>
          <CookieTarget index={index} disabled={phase === 'opening'} revealed={revealed} hidden={revealed}
            onChoose={choose} onHover={(value) => setHovered(value ? index : null)} />
        </div>)}</div>}
        <div ref={reveal} className={`fortune-reveal ${revealed ? 'is-visible' : ''}`} aria-hidden={!revealed}>
          <div className="fortune-paper" ref={paper} tabIndex={revealed ? -1 : undefined} aria-label="Your fortune for today">
            <div className="paper-topline"><span>YOUR LITTLE FORTUNE</span><Star /></div>
            <p className="fortune-text">{fortune?.text}</p>
            <div className="paper-bottomline"><span>KEEP A LITTLE HOPE CLOSE.</span><span>No. {fortune?.id}</span></div>
          </div>
          <div className="fortune-actions">
            <span className="fortune-date">{date} <span>·</span> yours for today</span>
            <button className="copy-button" onClick={copyFortune} tabIndex={revealed ? 0 : -1} aria-label="Copy your fortune">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor"/><path d="M12 4V3H3v9h1" stroke="currentColor" strokeLinecap="round"/></svg>
              {copied ? 'Copied' : 'Keep these words'}
            </button>
          </div>
        </div>
      </section>

      <div className="ritual-instruction">
        <div className="instruction-icon" aria-hidden="true">{revealed ? <Star/> : <svg width="24" height="27" viewBox="0 0 24 27" fill="none"><path d="M9 16V6a2 2 0 0 1 4 0v7l1-2c1-2 3-1 3 1 2-1 3 0 3 2v5c0 3-2 5-3 6H9l-6-8c-1-2 1-3 3-1l3 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/><path d="m4 4 2 1m11-3-1 2M10 0v2" stroke="currentColor" strokeLinecap="round"/></svg>}</div>
        <p>{phase === 'opening' ? 'A little possibility is unfolding…' : revealed ? 'Good things take their own sweet time.' : 'A little nudge. A little luck.'}</p>
        <span>{phase === 'opening' ? 'THIS MOMENT IS JUST FOR YOU' : revealed ? 'COME BACK TOMORROW FOR ANOTHER LITTLE FORTUNE' : 'CLICK, TAP, OR SWIPE A COOKIE TO REVEAL YOUR FORTUNE'}</span>
        {!persistent && <small className="storage-note">Your fortune will stay for this visit, but may reset when you leave.</small>}
      </div>
    </main>
    <footer className="site-footer"><span>BAKED WITH OPTIMISM</span><span className="footer-center" aria-hidden="true">✧</span><span>ONE COOKIE. COUNTLESS POSSIBILITIES.</span></footer>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{revealed && fortune ? `Your fortune for today: ${fortune.text}${copied ? ' Copied to clipboard.' : ''}` : ''}</div>
  </div>;
}
