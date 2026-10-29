// Delegated event handling: elements name their action with data-act (click) or data-enter / data-esc (keys).
type Handler = (el: HTMLElement, ev: Event) => void;

const handlers = new Map<string, Handler>();

export function on(actions: Record<string, Handler>): void {
  for (const [name, fn] of Object.entries(actions)) handlers.set(name, fn);
}

function run(name: string | undefined, el: HTMLElement, ev: Event): void {
  const fn = name ? handlers.get(name) : undefined;
  if (fn) fn(el, ev);
}

export function listen(): void {
  document.addEventListener("click", (ev) => {
    const el = (ev.target as Element).closest<HTMLElement>("[data-act]");
    if (el) run(el.dataset.act, el, ev);
  });
  document.addEventListener("keydown", (ev) => {
    const el = (ev.target as Element).closest<HTMLElement>("[data-enter],[data-esc]");
    if (!el) return;
    if (ev.key === "Enter") run(el.dataset.enter, el, ev);
    if (ev.key === "Escape") run(el.dataset.esc, el, ev);
  });
}

/** data-* attributes for an action button; values are escaped by the caller's esc(). */
export const act = (name: string, data: Record<string, string> = {}) =>
  `data-act="${name}"` + Object.entries(data).map(([k, v]) => ` data-${k}="${v}"`).join("");
