const TABLE =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(text: string): string {
  const g = globalThis as any;
  if (g?.Buffer?.from) {
    return g.Buffer.from(text, "utf8").toString("base64");
  }
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    out += TABLE[(triple >> 18) & 63]!;
    out += TABLE[(triple >> 12) & 63]!;
    out += i + 1 < bytes.length ? TABLE[(triple >> 6) & 63]! : "=";
    out += i + 2 < bytes.length ? TABLE[triple & 63]! : "=";
  }
  return out;
}

export function fromBase64(b64: string): string {
  const g = globalThis as any;
  if (g?.Buffer?.from) {
    return g.Buffer.from(b64, "base64").toString("utf8");
  }
  if (typeof g?.atob === "function") {
    const binary = g.atob(b64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  const cleaned = b64.replace(/\s/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    const a = TABLE.indexOf(cleaned[i]!);
    const b = TABLE.indexOf(cleaned[i + 1]!);
    const cChar = cleaned[i + 2]!;
    const dChar = cleaned[i + 3]!;
    const c = cChar === "=" ? 0 : TABLE.indexOf(cChar);
    const d = dChar === "=" ? 0 : TABLE.indexOf(dChar);
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    bytes.push((triple >> 16) & 255);
    if (cChar !== "=") bytes.push((triple >> 8) & 255);
    if (dChar !== "=") bytes.push(triple & 255);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
