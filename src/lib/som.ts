// Campainha sintetizada via Web Audio — sem depender de arquivo externo.
let ctx: AudioContext | null = null;

export function tocarSom() {
  try {
    ctx ??= new AudioContext();
    const audio = ctx;
    [0, 0.2].forEach((t) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(audio.destination);
      g.gain.setValueAtTime(0.4, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t + 0.5);
      o.start(audio.currentTime + t);
      o.stop(audio.currentTime + t + 0.5);
    });
  } catch { /* noop */ }
}
