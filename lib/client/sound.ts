let ctx: AudioContext | null = null;

/** Browsers only allow audio after a tap, so the kitchen taps "Sound on" once. */
export function enableSound() {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  ctx ??= new AC();
  void ctx.resume();
  tone(660, 0, 0.12, 0.05); // confirmation blip
}
function tone(freq: number, at: number, dur: number, vol = 0.18) {
  if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + at);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + dur + 0.05);
}
/** Two rising notes, like a temple bell, for a new order. */
export const chimeNew = () => { tone(784, 0, 0.35); tone(1175, 0.18, 0.5); };
/** Three sharp low beeps for an order that has waited too long. */
export const alarmLate = () => { [0, 0.3, 0.6].forEach((t) => tone(330, t, 0.22, 0.28)); };
