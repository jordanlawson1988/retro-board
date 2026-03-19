let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a pleasant bell/chime sound using Web Audio API.
 * No external audio files needed — generates a sine wave at ~800Hz
 * with harmonics and a gentle decay envelope.
 */
export function playTimerDing(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Create a pleasant chime with fundamental + harmonics
  const frequencies = [800, 1200, 1600];
  const gains = [0.4, 0.2, 0.1];

  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, now);

    // Gentle attack and decay envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gains[i], now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + 1.5);
  });
}

/**
 * Resume audio context after user interaction (required by browsers).
 */
export function resumeAudioContext(): void {
  if (audioContext?.state === 'suspended') {
    audioContext.resume();
  }
}
