import { useId } from 'react';

export function CookieIllustration({ cracked = false }: { cracked?: boolean }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 240 185" fill="none" aria-hidden="true" className={cracked ? 'cookie-illustration is-cracked' : 'cookie-illustration'}>
    <defs>
      <linearGradient id={`${id}a`} x1="100" y1="15" x2="160" y2="170" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f5d494"/><stop offset=".48" stopColor="#d7a454"/><stop offset="1" stopColor="#a2682f"/>
      </linearGradient>
      <linearGradient id={`${id}b`} x1="75" y1="24" x2="124" y2="147" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffe2a3"/><stop offset=".7" stopColor="#d8a85e"/><stop offset="1" stopColor="#b37736"/>
      </linearGradient>
      <radialGradient id={`${id}c`}><stop stopColor="#a96727" stopOpacity=".23"/><stop offset="1" stopColor="#a96727" stopOpacity="0"/></radialGradient>
      <filter id={`${id}n`} x="0" y="0" width="100%" height="100%"><feTurbulence baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".12"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter>
    </defs>
    <ellipse cx="121" cy="170" rx="95" ry="14" fill={`url(#${id}c)`}/>
    <g className="illustration-left">
      <path d="M122 26C77 2 22 30 17 76c-4 30 19 72 49 69 20-2 29-28 55-34l8-42-7-43Z" fill={`url(#${id}a)`}/>
      <path d="M122 26C92 20 48 38 36 68c-9 24 4 46 28 68 6-34 28-58 59-64l-1-46Z" fill={`url(#${id}b)`} filter={`url(#${id}n)`}/>
      <path d="M37 68c20-28 48-40 76-38M64 136c5-31 23-54 52-62" stroke="#a16b32" strokeOpacity=".35" strokeWidth="2"/>
    </g>
    <g className="illustration-right">
      <path d="M122 26c41-17 91 9 100 50 9 37-21 78-50 70-19-5-28-29-51-35 18-23 21-53 1-85Z" fill={`url(#${id}a)`}/>
      <path d="M122 26c35 13 62 23 81 46 18 24-3 53-31 74-2-38-24-59-49-74 8-17 8-33-1-46Z" fill={`url(#${id}b)`} filter={`url(#${id}n)`}/>
      <path d="M124 29c26 13 57 23 75 44M172 146c-2-37-22-56-48-73" stroke="#a16b32" strokeOpacity=".4" strokeWidth="2"/>
    </g>
    <path className="illustration-seam" d="M122 29c11 17 13 31 1 47" stroke="#925d2d" strokeWidth="4" strokeLinecap="round"/>
  </svg>;
}
