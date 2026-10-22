// Lazy loading prevents an unavailable audio module from blocking app startup.
const played = new Set<string>();
let audio: Promise<typeof import('expo-audio')> | undefined;
export function preparePaymentSound() {
  audio ??= import('expo-audio');
  void audio.catch(() => { audio = undefined; });
}

export function playPaymentSound(reference: string) {
  if (played.has(reference)) return;
  played.add(reference);
  void (async () => {
    try {
      const { createAudioPlayer } = await (audio ?? import('expo-audio'));
      const player = createAudioPlayer(require('../assets/sounds/payment-success.mp3'));
      player.play();
      // Keep the player alive after the payment sheet closes, then release it.
      setTimeout(() => {
        try { player.remove(); } catch { /* already released */ }
      }, 10_000);
    } catch { console.warn('Paiement enregistré ; son indisponible.'); }
  })();
}
