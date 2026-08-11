/**
 * MD5, RFC 1321.
 *
 * Hand-written because Web Crypto deliberately omits MD5 — it is broken for
 * anything security-shaped, and the platform will not help you do it. It is
 * still what package mirrors and older tooling print, which is the only reason
 * it is here.
 *
 * Never use this to compare secrets or verify signatures. Checksums only.
 */

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

/** K[i] = floor(2^32 * abs(sin(i + 1))), per the spec. */
const K = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32),
);

function rotateLeft(value: number, shift: number): number {
  return (value << shift) | (value >>> (32 - shift));
}

export function md5(input: Uint8Array): string {
  // Pad to 56 mod 64, then append the original bit length as a 64-bit LE value.
  const originalBits = input.length * 8;
  const paddedLength = ((input.length + 8) >> 6 << 6) + 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;

  const view = new DataView(bytes.buffer);
  // Only the low 32 bits of the length are written; inputs long enough to need
  // the high word do not reach this code path from a web request.
  view.setUint32(paddedLength - 8, originalBits >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(originalBits / 2 ** 32), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let chunk = 0; chunk < paddedLength; chunk += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i += 1) M[i] = view.getUint32(chunk + i * 4, true);

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i += 1) {
      let f: number;
      let g: number;

      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      f = (f + a + K[i] + M[g]) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotateLeft(f, S[i])) | 0;
    }

    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0 >>> 0, true);
  outView.setUint32(4, b0 >>> 0, true);
  outView.setUint32(8, c0 >>> 0, true);
  outView.setUint32(12, d0 >>> 0, true);

  return Array.from(out, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
