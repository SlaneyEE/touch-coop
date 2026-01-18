export async function compressOfferData(originalText: string) {
  const encoder = new TextEncoder();
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(encoder.encode(originalText));
  writer.close();
  const reader = stream.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const compressed = new Uint8Array(await new Blob(chunks).arrayBuffer());
  const base64 = btoa(String.fromCharCode(...compressed));
  const safeBase64 = base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return safeBase64;
}

export async function decompressOfferData(
  base64Input: string,
): Promise<string> {
  let base64 = (base64Input || "").trim();
  base64 = base64.replace(/\s+/g, "");
  base64 = base64.replace(/-/g, "+").replace(/_/g, "/");
  const mod = base64.length % 4;
  if (mod === 2) {
    base64 += "==";
  } else if (mod === 3) {
    base64 += "=";
  }
  const binaryString = atob(base64);
  const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
  const decompressedStream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(decompressedStream).text();
  return text;
}
