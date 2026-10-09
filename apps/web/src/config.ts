/** Nom affiché de l'application (en-tête, titres de page). */
export const APP_NAME = 'Quizlet'

export function pageTitle(title?: string): string {
  return title ? `${title} · ${APP_NAME}` : APP_NAME
}
