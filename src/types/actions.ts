/** Result of a mutating server action. Discriminated so callers must branch. */
export type SaveResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly error: string };
