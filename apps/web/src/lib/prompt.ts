import { LIMITS } from '@quizlet/shared'

/** Deux cartes d'exemple, au format que l'import détecte (point-virgule entre terme et définition). */
export const PROMPT_EXAMPLE_LINES = [
  'photosynthèse ; Processus par lequel les plantes transforment la lumière en énergie chimique.',
  'mitochondrie ; Organite de la cellule qui produit l’énergie (ATP).',
].join('\n')

/**
 * Prompt à copier dans Claude. Le format de sortie doit rester compatible avec `detectSeparators`
 * et `parseCards` (`@quizlet/shared`) : une seule tabulation dans le texte ferait basculer la
 * détection sur la tabulation et invaliderait les autres lignes, d'où l'interdiction explicite.
 */
export const CLAUDE_PROMPT = `Tu es un assistant pédagogique. Crée des cartes de révision (flashcards) sur le sujet suivant : [SUJET, OU COURS À COLLER ICI].

Paramètres :
- Nombre de cartes : [NOMBRE, ex. 30]
- Langue du terme : [LANGUE, ex. français]
- Langue de la définition : [LANGUE, ex. français]
- Niveau : [NIVEAU, ex. lycée]

Règles :
- Une carte = une seule notion : un terme court, une définition courte et précise.
- Pas de doublon.
- Si j'ai collé un cours, appuie-toi uniquement dessus et n'invente rien.

Format de la réponse (strict) :
1. Une première ligne « Titre : … » proposant un titre pour le set (${LIMITS.title} caractères au plus).
2. Puis UN SEUL bloc de code contenant uniquement les cartes, une par ligne, sous la forme : terme ; définition
   - Un point-virgule entre le terme et la définition. Le terme ne contient jamais de point-virgule ; la définition peut en contenir.
   - Aucune ligne d'en-tête, aucune numérotation, aucun guillemet, aucun Markdown, aucun saut de ligne à l'intérieur d'une carte.
   - Aucun caractère de tabulation.
   - Terme : ${LIMITS.term} caractères au plus. Définition : ${LIMITS.definition} caractères au plus.

Exemple de bloc de code attendu :
${PROMPT_EXAMPLE_LINES}`
