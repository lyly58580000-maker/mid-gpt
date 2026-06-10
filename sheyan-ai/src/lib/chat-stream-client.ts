export function isStreamingMessage(msg: { role: string; id: string }) {
  return msg.role === "assistant" && msg.id.startsWith("stream-");
}

export function createThrottledStreamWriter(write: (text: string) => void, intervalMs = 48) {
  let pending = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastWrite = 0;

  const flushNow = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastWrite = Date.now();
    write(pending);
  };

  return {
    push(text: string) {
      pending = text;
      const now = Date.now();
      if (now - lastWrite >= intervalMs) {
        flushNow();
        return;
      }
      if (!timer) {
        timer = setTimeout(flushNow, intervalMs - (now - lastWrite));
      }
    },
    flush: flushNow,
  };
}

export async function consumeTextStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += decoder.decode(value, { stream: true });
    onChunk(fullText);
  }

  fullText += decoder.decode();
  if (fullText) onChunk(fullText);
  return fullText;
}
