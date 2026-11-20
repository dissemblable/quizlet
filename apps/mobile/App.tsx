import type { AppType } from '@quizlet/api'
import { gradeSchema, LIMITS, RATINGS } from '@quizlet/shared'
import { fetch as expoFetch } from 'expo/fetch'
import { StatusBar } from 'expo-status-bar'
import { hc } from 'hono/client'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'

const BASE_URL = 'https://quizlet.valldoy.com'
const AUTH_URL = 'https://auth.valldoy.com'
const TIMEOUT_MS = 15000

// Vérification 6 : le client typé (AppType) compile et passe par Metro.
export const api = hc<AppType>(BASE_URL).api
export type MeCall = typeof api.me.$get

// Vérification 5 : que devient `redirect: 'manual'` ? Faux jeton => le proxy répond 302 vers le portail.
const FAKE = { Authorization: 'Bearer authelia_at_faux' }
const expoFetchAsFetch = expoFetch as unknown as typeof fetch
const PROBES: { label: string; url: string; fetcher: typeof fetch; init: RequestInit }[] = [
  {
    label: '0. contrôle réseau (découverte OIDC, attendu 200)',
    url: `${AUTH_URL}/.well-known/openid-configuration`,
    fetcher: fetch,
    init: {},
  },
  {
    label: "1. fetch global, redirect 'manual'",
    url: `${BASE_URL}/api/me`,
    fetcher: fetch,
    init: { redirect: 'manual', headers: FAKE },
  },
  {
    label: "2. expo/fetch, redirect 'manual'",
    url: `${BASE_URL}/api/me`,
    fetcher: expoFetchAsFetch,
    init: { redirect: 'manual', headers: FAKE },
  },
]

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`pas de réponse après ${TIMEOUT_MS} ms`)), TIMEOUT_MS),
  )
  return Promise.race([promise, timer])
}

async function run(probe: (typeof PROBES)[number]): Promise<string> {
  try {
    const res = await withTimeout(probe.fetcher(probe.url, probe.init))
    return [
      `status=${res.status} type=${res.type}`,
      `url=${res.url}`,
      `content-type=${res.headers.get('content-type')}`,
      `location=${res.headers.get('location')}`,
    ].join('\n  ')
  } catch (error) {
    return `ERREUR: ${String(error)}`
  }
}

export default function App() {
  const [results, setResults] = useState<Record<string, string>>(
    Object.fromEntries(PROBES.map((probe) => [probe.label, 'en cours…'])),
  )

  useEffect(() => {
    for (const probe of PROBES) {
      void run(probe).then((text) => setResults((old) => ({ ...old, [probe.label]: text })))
    }
  }, [])

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text selectable style={styles.line}>
        {`LIMITS.title=${LIMITS.title}\ngradeSchema ok=${gradeSchema.safeParse({ rating: RATINGS[0] }).success}`}
      </Text>
      {Object.entries(results).map(([label, text]) => (
        <Text key={label} selectable style={styles.line}>
          {`${label}\n  ${text}`}
        </Text>
      ))}
      <StatusBar style="auto" />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, backgroundColor: '#fff' },
  line: { fontFamily: 'monospace', marginBottom: 12 },
})
