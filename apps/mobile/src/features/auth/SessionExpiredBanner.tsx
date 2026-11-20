/**
 * CONTRAT : bannière « Votre session a expiré » + bouton « Se reconnecter » (`useAuth().signIn()`),
 * visible seulement si `status === 'expired'`, sinon `null`. Montée par le layout racine au-dessus du
 * `Stack` : elle gère l'inset du haut (`useSafeAreaInsets().top`) quand elle est affichée. Relancer la
 * connexion ne démonte pas les écrans (l'état est conservé).
 */
export function SessionExpiredBanner() {
  return null
}
