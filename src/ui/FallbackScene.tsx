import { useEffect } from 'react';
import type { SceneProps } from '../scene/FortuneScene';
import { CookieTarget } from './CookieTarget';
import { CookieIllustration } from './CookieIllustration';

const positions = [
  [15, 19, -17, 0.78], [37, 13, 13, 0.89], [65, 17, -18, 0.78], [87, 22, 22, 0.83],
  [10, 54, 12, 0.86], [35, 52, -13, 1.1], [63, 53, 8, 1.15], [90, 59, -15, 0.82],
  [27, 86, -14, 0.78], [78, 87, 13, 0.79],
];
export default function FallbackScene(props: SceneProps) {
  useEffect(() => {
    if (props.phase !== 'opening') return;
    const crack = window.setTimeout(props.onCrack, props.reducedMotion ? 0 : 700);
    const id = window.setTimeout(props.onReveal, props.reducedMotion ? 180 : 2800);
    return () => { window.clearTimeout(crack); window.clearTimeout(id); };
  }, [props.phase, props.reducedMotion, props.onReveal, props.onCrack]);
  return <div className={`fallback-scene ${props.phase !== 'idle' ? 'has-selection' : ''}`}>
    {positions.map(([x, y, rotation, scale], i) => <div key={i}
      className={`fallback-cookie ${props.phase !== 'idle' && props.selected === i ? 'is-selected' : ''}`}
      style={{ '--x': `${x}%`, '--y': `${y}%`, '--rotation': `${rotation}deg`, '--cookie-scale': scale, '--delay': `${i * -1.3}s` } as React.CSSProperties}>
      <CookieIllustration cracked={props.phase !== 'idle' && props.selected === i} />
      <CookieTarget index={i} disabled={props.phase === 'opening'} revealed={props.phase === 'revealed'} hidden={props.phase === 'revealed'} onChoose={props.onChoose} />
    </div>)}
  </div>;
}
