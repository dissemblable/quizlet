import { IMPORT_MAX_BYTES } from '@quizlet/shared'
import { describe, expect, it, vi } from 'vitest'
import { type ImportFile, readImportFile } from './import-file'

const encode = (text: string) => new TextEncoder().encode(text)

function file(name: string, bytes: Uint8Array, size = bytes.length): ImportFile {
  return { name, size, bytes: vi.fn(async () => bytes) }
}

describe('readImportFile', () => {
  it('lit un CSV UTF-8', async () => {
    const result = await readImportFile(file('mots.csv', encode('chat ; cat\nété ; summer')))
    expect(result).toEqual({ ok: true, text: 'chat ; cat\nété ; summer' })
  })

  it('retire le BOM UTF-8 (export « CSV UTF-8 » d’Excel)', async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('a;b')])
    expect(await readImportFile(file('excel.csv', bytes))).toEqual({ ok: true, text: 'a;b' })
  })

  it('accepte .txt et ignore la casse de l’extension', async () => {
    for (const name of ['mots.txt', 'MOTS.CSV', 'Mots.Txt', 'a.b.csv', '.csv']) {
      expect((await readImportFile(file(name, encode('x ; y')))).ok).toBe(true)
    }
  })

  it('refuse une autre extension, sans lire le fichier', async () => {
    for (const name of ['mots.pdf', 'mots.csv.exe', 'mots', 'mots.csvx', 'csv', '']) {
      const entry = file(name, encode('x ; y'))
      expect(await readImportFile(entry)).toEqual({
        ok: false,
        error: 'Choisissez un fichier .csv ou .txt.',
      })
      expect(entry.bytes).not.toHaveBeenCalled()
    }
  })

  it('refuse un fichier trop volumineux, sans le lire', async () => {
    const entry = file('gros.csv', encode('x'), IMPORT_MAX_BYTES + 1)
    expect(await readImportFile(entry)).toEqual({
      ok: false,
      error: 'Fichier trop volumineux : 1 Mo au maximum.',
    })
    expect(entry.bytes).not.toHaveBeenCalled()
  })

  it('accepte exactement IMPORT_MAX_BYTES', async () => {
    const bytes = new Uint8Array(IMPORT_MAX_BYTES).fill(0x61)
    const result = await readImportFile(file('limite.csv', bytes))
    expect(result.ok).toBe(true)
  })

  it('re-vérifie la taille sur les octets lus quand `size` vaut 0 (illisible)', async () => {
    const bytes = new Uint8Array(IMPORT_MAX_BYTES + 1).fill(0x61)
    expect(await readImportFile(file('gros.csv', bytes, 0))).toEqual({
      ok: false,
      error: 'Fichier trop volumineux : 1 Mo au maximum.',
    })
  })

  it('refuse un fichier qui n’est pas en UTF-8 (Latin-1), avec le message du web', async () => {
    const latin1 = new Uint8Array([
      0x63, 0x61, 0x66, 0xe9, 0x3b, 0x63, 0x6f, 0x66, 0x66, 0x65, 0x65,
    ])
    expect(await readImportFile(file('latin1.csv', latin1))).toEqual({
      ok: false,
      error:
        "Ce fichier n'est pas encodé en UTF-8. Enregistrez-le au format « CSV UTF-8 » puis réessayez.",
    })
  })

  it('un fichier vide donne un texte vide', async () => {
    expect(await readImportFile(file('vide.txt', new Uint8Array(0)))).toEqual({
      ok: true,
      text: '',
    })
  })

  it('ne rejette jamais : une lecture qui échoue donne un message français', async () => {
    const broken: ImportFile = {
      name: 'mots.csv',
      size: 10,
      bytes: () => Promise.reject(new Error('EACCES')),
    }
    expect(await readImportFile(broken)).toEqual({
      ok: false,
      error: 'Impossible de lire ce fichier.',
    })
  })
})
