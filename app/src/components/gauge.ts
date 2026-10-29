// Trust gauge: a half-circle arc filled to the average confidence.
import { $ } from "../dom.js";

const R = 86;
const ARC = "M24 112 A86 86 0 0 1 196 112";

export function renderGauge(value: number): void {
  const c = Math.PI * R;
  $("gauge").innerHTML =
    '<defs><pattern id="hp" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    '<rect width="7" height="7" fill="#fff"/><rect width="2.4" height="7" fill="#1A1A1A"/></pattern></defs>' +
    `<path d="${ARC}" fill="none" stroke="url(#hp)" stroke-width="22"/>` +
    `<path d="${ARC}" fill="none" stroke="#1A1A1A" stroke-width="22" stroke-dasharray="${(c * value).toFixed(1)} ${c.toFixed(1)}"/>` +
    `<text x="110" y="100" text-anchor="middle" font-size="34" font-weight="800" fill="#141414" font-family="inherit">${Math.round(value * 100)}%</text>` +
    '<text x="110" y="120" text-anchor="middle" font-size="11" fill="#8A8F98" font-family="inherit">average confidence</text>';
}
