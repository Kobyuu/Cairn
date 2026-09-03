// El tono del aviso: "un tono corto y grave" (handoff, seccion Ajustes).
//
// Se sintetiza con WebAudio en vez de empaquetar un `.wav`: son doce lineas de
// una API de la plataforma contra un archivo binario en el repo, un `fetch`
// -que en una app sin red es justo lo que no queremos- y un formato mas que
// mantener. Tampoco entra ninguna dependencia (CLAUDE.md §5).

/** Un solo contexto para toda la vida de la ventana; crear uno por tono los
 *  acumula hasta que el navegador corta a los seis. */
let context: AudioContext | null = null;

/**
 * Destraba el audio en el primer gesto del usuario sobre esta ventana.
 *
 * Chromium -y WebView2, que es Chromium- deja **suspendido** un `AudioContext`
 * creado sin un gesto previo, y el aviso llega justamente cuando nadie toco
 * nada. Sin esto, arrancar la PC con el inicio automatico y no tocar Cairn
 * daria un primer aviso mudo, con el interruptor de Ajustes diciendo que suena.
 *
 * Se crea el contexto DENTRO del gesto, que es lo que lo destraba; a partir de
 * ahi queda vivo para toda la ventana. Devuelve el limpiador, para poder
 * llamarla desde un `useEffect` y no dejar el listener colgado.
 */
export function unlockAudioOnFirstGesture(): () => void {
  const unlock = () => {
    try {
      context ??= new AudioContext();
      void context.resume().catch(() => undefined);
    } catch (cause) {
      console.error("[cairn] no se pudo preparar el audio:", cause);
    }
  };
  document.addEventListener("pointerdown", unlock, { once: true });
  return () => document.removeEventListener("pointerdown", unlock);
}

/**
 * Suena una vez. No hace nada -y no rompe- si el audio no esta disponible.
 *
 * El `.catch` del `resume()` no es adorno: cuando la politica de autoplay lo
 * rechaza, la promesa se REJECTA, y sin el manejador queda una rejection sin
 * atrapar en la consola del webview en cada aviso.
 */
export function playAlertTone(): void {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => undefined);

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    // 174 Hz: grave, sin llegar al zumbido que se confunde con un ventilador.
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(174, now);

    // La envolvente es lo que lo hace un tono y no un chasquido: un ataque de
    // 40 ms y una caida exponencial. Arrancar y cortar en seco produce un clic
    // audible en los dos extremos.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.9);
  } catch (cause) {
    // Sin audio en el sistema, o el contexto rechazado: el aviso visual ya
    // ocurrio y esto era el complemento. Va a la consola del webview.
    console.error("[cairn] no se pudo reproducir el aviso:", cause);
  }
}
