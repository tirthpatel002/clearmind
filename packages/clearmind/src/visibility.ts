// Per-item visibility. A viewer is the principal looking; items carry visibleTo (principal ids). "workspace" = everyone
// in the workspace (the default when absent). An admin viewer, or no viewer at all (legacy/owner calls), sees everything.
// Filtering is SQL over the indexed cm_acl(item_kind, item_id, principal) side table; items with no acl rows are workspace.

export interface Viewer { id: string; admin?: boolean }
export const WORKSPACE = "workspace";
export const ADMIN = "admin";

/** True when the viewer is unrestricted (no viewer, admin flag, or the admin principal). */
export const fullAccess = (v?: Viewer | null): boolean => !v || !!v.admin || v.id === ADMIN;

/** Normalised visibleTo list: trimmed, unique, non-empty; defaults to ["workspace"]. */
export function normVisibleTo(v?: string[] | string | null): string[] {
  const xs = (Array.isArray(v) ? v : v ? [v] : []).map((s) => String(s ?? "").trim()).filter(Boolean);
  const u = [...new Set(xs)];
  return u.length ? u : [WORKSPACE];
}

/** Pure check over a visibleTo list (for items held in memory, e.g. files). */
export function allows(visibleTo: string[] | undefined | null, v?: Viewer | null): boolean {
  if (fullAccess(v)) return true;
  const l = visibleTo && visibleTo.length ? visibleTo : [WORKSPACE];
  return l.includes(WORKSPACE) || l.includes(v!.id);
}

/** Principals that grant this viewer access (bound as SQL parameters). */
export const principalsOf = (v: Viewer): [string, string] => [WORKSPACE, v.id];

/** SQL: is item `col` of `kind` visible to the viewer whose principals bind to the two `?` (WORKSPACE, id). Uses the cm_acl PK. */
export const aclSql = (kind: string, col: string) =>
  `(NOT EXISTS (SELECT 1 FROM cm_acl a0 WHERE a0.item_kind='${kind}' AND a0.item_id=${col})
    OR EXISTS (SELECT 1 FROM cm_acl a1 WHERE a1.item_kind='${kind}' AND a1.item_id=${col} AND a1.principal IN (?,?)))`;
