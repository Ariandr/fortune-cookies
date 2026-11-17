import { useId } from 'react';

export function CookieIllustration({ cracked = false }: { cracked?: boolean }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 240 185" fill="none" aria-hidden="true" className={cracked ? 'cookie-illustration is-cracked' : 'cookie-illustration'}>
    <defs>
      <linearGradient id={`${id}a`} x1="100" y1="8" x2="156" y2="167" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f6d892"/><stop offset=".48" stopColor="#e5bb65"/><stop offset="1" stopColor="#c49142"/>
      </linearGradient>
      <radialGradient id={`${id}b`} cx=".38" cy=".35" r=".7">
        <stop stopColor="#fff0bd"/><stop offset=".6" stopColor="#efd089"/><stop offset="1" stopColor="#c78d3b"/>
      </radialGradient>
      <radialGradient id={`${id}c`}><stop stopColor="#a96727" stopOpacity=".2"/><stop offset="1" stopColor="#a96727" stopOpacity="0"/></radialGradient>
      <filter id={`${id}n`} x="0" y="0" width="100%" height="100%"><feTurbulence baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".1"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter>
    </defs>
    <ellipse cx="121" cy="172" rx="83" ry="10" fill={`url(#${id}c)`}/>
    <g className="illustration-left">
      <path d="M120 8A88 88 0 0 0 58 158L73 145C101 118 100 86 120 72Z" fill={`url(#${id}a)`}/>
      <path d="M120 17C65 17 25 86 61 149L73 145C101 118 100 86 120 67Z" fill={`url(#${id}b)`} filter={`url(#${id}n)`}/>
      <path d="M120 10C62 10 21 84 58 155" stroke="#b37d34" strokeOpacity=".45" strokeWidth="1.7"/>
      <path d="M119 57C93 68 99 104 81 135" stroke="#fff0ba" strokeOpacity=".55" strokeWidth="1.4"/>
    </g>
    <g className="illustration-right">
      <path d="M120 8A88 88 0 0 1 182 158L167 145C139 118 140 86 120 72Z" fill={`url(#${id}a)`}/>
      <path d="M120 17C175 17 215 86 179 149L167 145C139 118 140 86 120 67Z" fill={`url(#${id}b)`} filter={`url(#${id}n)`}/>
      <path d="M120 10C178 10 219 84 182 155" stroke="#b37d34" strokeOpacity=".45" strokeWidth="1.7"/>
      <path d="M121 57C147 68 141 104 159 135" stroke="#fff0ba" strokeOpacity=".5" strokeWidth="1.4"/>
    </g>
  </svg>;
}
