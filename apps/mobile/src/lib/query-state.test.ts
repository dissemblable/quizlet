import { describe, expect, it } from 'vitest'
import { queryView } from './query-state'

type Query = Parameters<typeof queryView>[0]
const query = (overrides: Partial<Query>): Query => ({
  isPending: false,
  isError: false,
  fetchStatus: 'idle',
  ...overrides,
})

describe('queryView', () => {
  it('« offline » : jamais chargée et en pause', () => {
    expect(queryView(query({ isPending: true, fetchStatus: 'paused' }))).toBe('offline')
  })

  it('« loading » : jamais chargée, en cours ou désactivée', () => {
    expect(queryView(query({ isPending: true, fetchStatus: 'fetching' }))).toBe('loading')
    expect(queryView(query({ isPending: true, fetchStatus: 'idle' }))).toBe('loading')
  })

  it('« error » : statut en erreur', () => {
    expect(queryView(query({ isError: true }))).toBe('error')
  })

  it('« error » prime sur la pause : un rafraîchissement raté après un succès reste « error »', () => {
    expect(queryView(query({ isError: true, fetchStatus: 'paused' }))).toBe('error')
    expect(queryView(query({ isError: true, fetchStatus: 'fetching' }))).toBe('error')
  })

  it('« ready » : données présentes, y compris pendant un rafraîchissement ou en pause', () => {
    expect(queryView(query({}))).toBe('ready')
    expect(queryView(query({ fetchStatus: 'fetching' }))).toBe('ready')
    expect(queryView(query({ fetchStatus: 'paused' }))).toBe('ready')
  })
})
