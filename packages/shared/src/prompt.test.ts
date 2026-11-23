import { describe, expect, it } from 'vitest'
import { detectSeparators, parseCards } from './import'
import { CLAUDE_PROMPT, PROMPT_EXAMPLE_LINES } from './prompt'

describe('prompt à copier', () => {
  it("contient l'exemple, que l'import lit sans ligne ignorée", () => {
    expect(CLAUDE_PROMPT).toContain(PROMPT_EXAMPLE_LINES)
    const { cards, invalid } = parseCards(
      PROMPT_EXAMPLE_LINES,
      detectSeparators(PROMPT_EXAMPLE_LINES),
    )
    expect(cards).toHaveLength(2)
    expect(invalid).toHaveLength(0)
  })

  it('ne contient aucune tabulation', () => {
    expect(CLAUDE_PROMPT).not.toContain('\t')
  })
})
