import { describe, expect, it } from 'vitest'
import { parseSetReference } from './links'

const ID = '3f2b8c1e-5a4d-4e7f-9b21-0c6d7e8f9a10'

describe('parseSetReference', () => {
  it('UUID nu, espaces autour ignorés, renvoyé en minuscules', () => {
    expect(parseSetReference(ID)).toBe(ID)
    expect(parseSetReference(`  ${ID}\n`)).toBe(ID)
    expect(parseSetReference(ID.toUpperCase())).toBe(ID)
  })

  it('URL de set, avec ou sans suite', () => {
    expect(parseSetReference(`https://quizlet.example.com/sets/${ID}`)).toBe(ID)
    expect(parseSetReference(`  https://quizlet.example.com/sets/${ID}  `)).toBe(ID)
    expect(parseSetReference(`https://quizlet.example.com/sets/${ID}/`)).toBe(ID)
    expect(parseSetReference(`https://quizlet.example.com/sets/${ID}/quiz`)).toBe(ID)
    expect(parseSetReference(`https://quizlet.example.com/sets/${ID}/edit?x=1#haut`)).toBe(ID)
    expect(parseSetReference(`https://quizlet.example.com/sets/${ID}?x=1`)).toBe(ID)
    expect(parseSetReference(`https://quizlet.example.com/sets/${ID}#haut`)).toBe(ID)
  })

  it('n’importe quel hôte, http, port, préfixe de chemin, UUID en majuscules', () => {
    expect(parseSetReference(`http://localhost:5180/sets/${ID}`)).toBe(ID)
    expect(parseSetReference(`HTTPS://Quizlet.Example.com:8443/app/sets/${ID.toUpperCase()}`)).toBe(
      ID,
    )
  })

  it('renvoie null pour le reste', () => {
    for (const input of [
      '',
      '   ',
      'bonjour',
      '3f2b8c1e',
      `${ID}x`,
      `x${ID}`,
      `${ID}${ID}`,
      '3f2b8c1e-5a4d-4e7f-9b21-0c6d7e8f9a1',
      '3f2b8c1e-5a4d-4e7f-9b21-0c6d7e8f9a1g',
      `https://quizlet.example.com/sets/${ID}0`,
      `https://quizlet.example.com/sets/${ID}abc`,
      'https://quizlet.example.com/sets/nouveau',
      'https://quizlet.example.com/sets/new',
      `https://quizlet.example.com/folders/${ID}`,
      `https://quizlet.example.com/?next=/sets/${ID}`,
      `https://quizlet.example.com#/sets/${ID}`,
      `ftp://quizlet.example.com/sets/${ID}`,
      `quizlet.example.com/sets/${ID}`,
      `voici le lien https://quizlet.example.com/sets/${ID}`,
    ]) {
      expect(parseSetReference(input), input).toBeNull()
    }
  })
})
