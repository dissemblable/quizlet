/** Valeur observable minimale (lisible hors React, compatible `useSyncExternalStore`). */
export interface Observable<T> {
  get(): T
  set(next: T): void
  subscribe(listener: (value: T) => void): () => void
}

export function createObservable<T>(initial: T): Observable<T> {
  let value = initial
  const listeners = new Set<(value: T) => void>()
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return
      value = next
      for (const listener of [...listeners]) {
        try {
          listener(next)
        } catch {
          // Un abonné défaillant ne doit pas empêcher les autres d'être notifiés.
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
