import { useRef, type PointerEvent } from 'react';
import { movedEnough, type GestureStart } from '../lib/gestures';

interface Props {
  index: number;
  disabled: boolean;
  revealed: boolean;
  hidden?: boolean;
  large?: boolean;
  onChoose: (index: number) => void;
  onHover?: (hovered: boolean) => void;
}
export function CookieTarget({ index, disabled, hidden, large, onChoose, onHover }: Props) {
  const start = useRef<GestureStart | null>(null);
  const swallowClick = useRef(false);
  function down(event: PointerEvent<HTMLButtonElement>) {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, fired: false };
    swallowClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const gesture = start.current;
    if (!gesture || gesture.id !== event.pointerId || gesture.fired) return;
    if (movedEnough(gesture, event.clientX, event.clientY)) {
      gesture.fired = true;
      swallowClick.current = true;
      onChoose(index);
    }
  }
  return <button type="button"
    className={`cookie-target${large ? ' cookie-target--large' : ''}`}
    aria-label={`Open fortune cookie ${index + 1}`}
    disabled={disabled || hidden}
    aria-hidden={hidden || undefined}
    tabIndex={hidden ? -1 : 0}
    onPointerDown={down} onPointerMove={move}
    onPointerUp={(event) => {
      if (start.current?.id === event.pointerId) {
        start.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }}
    onPointerCancel={() => { start.current = null; swallowClick.current = true; }}
    onLostPointerCapture={() => { start.current = null; }}
    onClick={(event) => {
      if (swallowClick.current && event.detail !== 0) { swallowClick.current = false; return; }
      onChoose(index);
    }}
    onPointerEnter={() => onHover?.(true)} onPointerLeave={() => onHover?.(false)}
    onFocus={() => onHover?.(true)} onBlur={() => onHover?.(false)}
  ><span className="cookie-target__hint" aria-hidden="true">choose me</span></button>;
}
