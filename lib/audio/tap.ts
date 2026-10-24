/** Gather this long (and at least MIN_CHUNK_BYTES) of the stream before decoding it. */
const CHUNK_MS = 500;
const MIN_CHUNK_BYTES = 4096;
/** Decoded audio further ahead than this means we fell behind the live edge: restart scheduling at "now". */
const MAX_LEAD_S = 2;
/** Consecutive chunks that fail to decode before the tap gives up on a stream (HLS playlists, odd codecs). */
const MAX_FAILURES = 5;

export type StreamTap = {
  /** Fed only by the tap's decoded audio; muted, never audible. */
  readonly analyser: AnalyserNode;
  /** Fetching and decoding a stream right now. */
  readonly running: boolean;
  /** gaveUp names the stream the tap couldn't decode; it isn't retried. */
  readonly stats: { chunks: number; failures: number; gaveUp: string | null };
  start(url: string): void;
  stop(): void;
};

/**
 * A second, silent copy of a live stream, decoded in the page purely so the visualizer has something to analyse.
 * For browsers (iOS Safari) that play the stream through the <audio> element but hand Web Audio only silence.
 * Costs a second download of the stream while it runs.
 */
export function createStreamTap(ctx: AudioContext, fetchImpl: typeof fetch = (...a) => fetch(...a)): StreamTap {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.5;
  const mute = ctx.createGain();
  mute.gain.value = 0;
  // Connected through a muted gain so the graph keeps pulling the analyser without anything being heard.
  analyser.connect(mute);
  mute.connect(ctx.destination);

  let controller: AbortController | null = null;
  let next = 0;
  const stats = { chunks: 0, failures: 0, gaveUp: null as string | null };

  const schedule = (buffer: AudioBuffer) => {
    const now = ctx.currentTime;
    let at = Math.max(next, now + 0.05);
    if (at - now > MAX_LEAD_S) at = now + 0.05;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(analyser);
    src.onended = () => src.disconnect();
    src.start(at);
    next = at + buffer.duration;
  };

  async function run(url: string, signal: AbortSignal) {
    const res = await fetchImpl(url, { signal, cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !res.body || /mpegurl|text\//i.test(type)) throw new Error(`untappable stream (${res.status} ${type})`);
    const reader = res.body.getReader();
    let parts: Uint8Array[] = [];
    let bytes = 0;
    let since = performance.now();
    // Decodes run one after another so chunks are scheduled in order.
    let decoding: Promise<void> = Promise.resolve();

    const flush = () => {
      const buf = new Uint8Array(bytes);
      let o = 0;
      for (const p of parts) {
        buf.set(p, o);
        o += p.length;
      }
      parts = [];
      bytes = 0;
      decoding = decoding.then(() =>
        ctx.decodeAudioData(buf.buffer).then(
          (audio) => {
            if (signal.aborted) return;
            stats.chunks++;
            stats.failures = 0;
            schedule(audio);
          },
          () => {
            if (++stats.failures >= MAX_FAILURES && !signal.aborted) {
              stats.gaveUp = url;
              controller?.abort();
            }
          },
        ),
      );
    };

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      bytes += value.length;
      const now = performance.now();
      if (now - since >= CHUNK_MS && bytes >= MIN_CHUNK_BYTES) {
        since = now;
        flush();
      }
    }
    // A live stream that ends is a dead stream: don't let the caller reconnect in a loop.
    if (!signal.aborted) throw new Error("stream ended");
  }

  return {
    analyser,
    get running() {
      return controller !== null;
    },
    stats,
    start(url) {
      this.stop();
      if (stats.gaveUp === url) return;
      stats.failures = 0;
      const c = new AbortController();
      controller = c;
      next = 0;
      run(url, c.signal)
        .catch(() => {
          if (!c.signal.aborted) stats.gaveUp = url;
        })
        .finally(() => {
          if (controller === c) controller = null;
        });
    },
    stop() {
      controller?.abort();
      controller = null;
    },
  };
}
