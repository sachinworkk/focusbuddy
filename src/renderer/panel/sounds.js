// Tiny WebAudio beeps — no sound-file assets needed, keeps the repo small.
let audioCtx = null;

function getContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function tone({ freq, duration, type = 'sine', gain = 0.05, delay = 0 }) {
  const ctx = getContext();
  const start = ctx.currentTime + delay;

  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, start);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(gain, start);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gainNode).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

window.focusbuddySounds = {
  click() {
    tone({ freq: 520, duration: 0.06, type: 'sine', gain: 0.04 });
  },
  select() {
    tone({ freq: 660, duration: 0.08, type: 'sine', gain: 0.05 });
  },
  start() {
    tone({ freq: 440, duration: 0.12, type: 'triangle', gain: 0.06 });
    tone({ freq: 660, duration: 0.14, type: 'triangle', gain: 0.06, delay: 0.08 });
  },
  celebrate() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone({ freq, duration: 0.18, type: 'triangle', gain: 0.06, delay: i * 0.09 })
    );
  },
};
