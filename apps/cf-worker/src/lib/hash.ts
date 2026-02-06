export async function computeSHA256(
  data: ArrayBuffer | Uint8Array,
): Promise<string> {
  const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function readHeaderBytes(
  stream: ReadableStream<Uint8Array>,
  headerSize = 8192,
): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (totalSize < headerSize) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.byteLength;
    }
  } finally {
    void reader.cancel();
  }

  const combined = new Uint8Array(Math.min(totalSize, headerSize));
  let offset = 0;
  for (const chunk of chunks) {
    const bytesToCopy = Math.min(chunk.byteLength, headerSize - offset);
    combined.set(chunk.subarray(0, bytesToCopy), offset);
    offset += bytesToCopy;
    if (offset >= headerSize) break;
  }

  return combined.buffer;
}
