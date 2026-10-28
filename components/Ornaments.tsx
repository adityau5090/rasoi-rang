/** Hand-built SVG ornaments: a twelve-petal mandala and the diya used on the order tracker. */
export function Mandala({ size = 56 }: { size?: number }) {
  const petals = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg className="mandala" width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true">
      <circle r="47" fill="#7c1d12" stroke="#eda91d" strokeWidth="3" />
      {petals.map((a) => <ellipse key={a} cx="0" cy="-27" rx="7" ry="16" fill={a % 60 ? '#cf4a6f' : '#eda91d'} transform={`rotate(${a})`} />)}
      {petals.map((a) => <circle key={`d${a}`} cx="0" cy="-42" r="2.2" fill="#fff3d6" transform={`rotate(${a + 15})`} />)}
      <circle r="13" fill="#0b5c5b" stroke="#fbe3a1" strokeWidth="2.5" />
      <circle r="5" fill="#eda91d" />
    </svg>
  );
}

export function Diya({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 66 66" aria-hidden="true">
      {lit && <circle cx="33" cy="28" r="22" fill="#eda91d" opacity=".28" />}
      {lit ? (
        <g className="flame">
          <path d="M33 8 C25 20 25 28 33 34 C41 28 41 20 33 8 Z" fill="#eda91d" />
          <path d="M33 18 C29 25 29 29 33 33 C37 29 37 25 33 18 Z" fill="#fff3d6" />
        </g>
      ) : (
        <path d="M33 22 v10" stroke="#a58a77" strokeWidth="2.5" strokeLinecap="round" />
      )}
      <path d="M8 36 H58 C58 50 47 58 33 58 C19 58 8 50 8 36 Z" fill={lit ? '#a52a1b' : '#c9b4a4'} stroke="#3a1a0e" strokeWidth="2.5" />
      <path d="M16 42 H50" stroke={lit ? '#eda91d' : '#e5d6c9'} strokeWidth="2.5" strokeDasharray="2 4" strokeLinecap="round" />
    </svg>
  );
}
