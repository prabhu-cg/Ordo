/** Unique, collision-resistant ids without a dependency. */
export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}
