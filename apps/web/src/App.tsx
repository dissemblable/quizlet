import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export function App() {
  const [status, setStatus] = useState<string>('…')

  useEffect(() => {
    api.api.health
      .$get()
      .then((res) => res.json())
      .then((body) => setStatus(body.status))
      .catch(() => setStatus('injoignable'))
  }, [])

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Quizlet</h1>
      <p className="mt-2 text-sm text-gray-500">API : {status}</p>
    </main>
  )
}
