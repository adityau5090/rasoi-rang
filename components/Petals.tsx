/** A shower of marigold petals for when the food is ready. Pure CSS; respects reduced-motion. */
export default function Petals() {
  return (
    <div className="petals" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.35}s`, animationDuration: `${3.4 + (i % 5) * 0.55}s`, ['--dx' as string]: `${((i % 6) - 3) * 28}px` }} />
      ))}
    </div>
  );
}
