// @vitest-environment jsdom
import { AI_LIMITS, MESSAGES } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import { filesProblem, readLines } from './generate'

function streamOf(chunks: string[]) {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect(chunks: string[]) {
  const lines: string[] = []
  for await (const line of readLines(streamOf(chunks))) lines.push(line)
  return lines
}

describe('readLines', () => {
  it('recolle les lignes coupées entre deux paquets', async () => {
    expect(await collect(['{"a":', '1}\n{"b"', ':2}\n'])).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('rend la dernière ligne sans retour à la ligne final', async () => {
    expect(await collect(['un\ndeux'])).toEqual(['un', 'deux'])
    expect(await collect([])).toEqual([])
  })
})

describe('filesProblem', () => {
  const file = (name: string, type: string, size = 1) =>
    new File([new Uint8Array(size)], name, { type })

  it('accepte PDF, images et texte', () => {
    expect(filesProblem([])).toBeNull()
    expect(filesProblem([file('a.pdf', 'application/pdf'), file('b.jpg', 'image/jpeg')])).toBeNull()
  })

  it('refuse les autres formats, les images trop lourdes et les envois trop gros', () => {
    expect(filesProblem([file('a.docx', '')])).toBe(MESSAGES.aiFileType)
    expect(filesProblem([file('a.png', 'image/png', AI_LIMITS.imageBytes + 1)])).toBe(
      MESSAGES.aiImageTooLarge,
    )
    expect(filesProblem([file('a.pdf', 'application/pdf', AI_LIMITS.requestBytes + 1)])).toBe(
      MESSAGES.aiRequestTooLarge,
    )
    expect(
      filesProblem(Array.from({ length: AI_LIMITS.files + 1 }, () => file('a.txt', 'text/plain'))),
    ).toBe(MESSAGES.aiTooManyFiles)
  })
})
