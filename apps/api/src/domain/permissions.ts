import type { Visibility } from '@quizlet/shared'

export interface SetAccess {
  ownerId: string
  visibility: Visibility
}

/** Lecture : l'auteur, ou tout utilisateur authentifié si le set est public. */
export function canView(set: SetAccess, userId: string): boolean {
  return set.ownerId === userId || set.visibility === 'public'
}

/** Modification et suppression : l'auteur uniquement. */
export function canEdit(set: SetAccess, userId: string): boolean {
  return set.ownerId === userId
}

export type AccessDecision = 'allowed' | 'not-found' | 'forbidden'

/**
 * Décision d'accès. Un set invisible pour l'utilisateur répond « introuvable » (404) plutôt
 * qu'« interdit » (403), pour ne pas révéler l'existence d'un set privé.
 */
export function decideAccess(
  set: SetAccess | undefined,
  userId: string,
  action: 'view' | 'edit',
): AccessDecision {
  if (!set || !canView(set, userId)) return 'not-found'
  if (action === 'edit' && !canEdit(set, userId)) return 'forbidden'
  return 'allowed'
}
