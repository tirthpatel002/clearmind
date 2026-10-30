// Fake embedder for testing offline replay runner with --retriever embedding
// Generates deterministic 64-dimensional hash-based unit vectors
import { createHash } from "node:crypto";

const DIM = 64;

function hashToken(token) {
  const hash = createHash("sha256").update(token).digest();
  const idx = hash.readUInt16LE(0) % DIM;
  const sign = (hash.readUInt8(2) & 1) === 1 ? 1 : -1;
  return { idx, sign };
}

function embedSingle(text) {
  const vec = new Float32Array(DIM);
  const tokens = (text.toLowerCase().match(/[a-z0-9_-]+/g) || []);
  if (tokens.length === 0) {
    vec.fill(1.0 / Math.sqrt(DIM));
    return vec;
  }

  for (const token of tokens) {
    const { idx, sign } = hashToken(token);
    vec[idx] += sign;
  }

  let norm = 0;
  for (let i = 0; i < DIM; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < DIM; i++) {
      vec[i] /= norm;
    }
  } else {
    vec.fill(1.0 / Math.sqrt(DIM));
  }
  return vec;
}

export default async function embed(texts) {
  return texts.map((t) => embedSingle(t));
}
