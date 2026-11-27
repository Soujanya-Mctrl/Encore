import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

type ApiStatus = 'unconfigured' | 'checking' | 'reachable' | 'unreachable'

const apiBaseUrl = process.env.EXPO_PUBLIC_ENCORE_API_URL?.replace(/\/$/, '')
const programId = process.env.EXPO_PUBLIC_ENCORE_PROGRAM_ID
const programReady = !!programId && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(programId) && programId !== '11111111111111111111111111111111'

export function EncoreApiStatus() {
  const [status, setStatus] = useState<ApiStatus>(apiBaseUrl ? 'checking' : 'unconfigured')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!apiBaseUrl) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    void fetch(`${apiBaseUrl}/api/v1/health`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { status?: string; cluster?: string }
        return response.ok && body.status === 'ok' && body.cluster === 'devnet'
      })
      .then((reachable) => setStatus(reachable ? 'reachable' : 'unreachable'))
      .catch(() => setStatus('unreachable'))
      .finally(() => clearTimeout(timeout))
    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [retryCount])

  return (
    <View className="gap-2 rounded-xl border border-gray-300 p-4 dark:border-gray-700">
      <Text className="text-base font-semibold text-gray-900 dark:text-white">Encore API</Text>
      <Text className="text-sm text-gray-600 dark:text-gray-300">
        {status === 'reachable' && 'Devnet backend reachable from this device.'}
        {status === 'checking' && 'Checking backend connection...'}
        {status === 'unreachable' && 'Backend unavailable. Check the API URL and that the web server is running.'}
        {status === 'unconfigured' && 'Set EXPO_PUBLIC_ENCORE_API_URL in apps/mobile/.env.local.'}
      </Text>
      <Text className="text-sm text-gray-600 dark:text-gray-300">
        Provenance fields are ready. {programReady ? 'Program ID configured.' : 'Devnet program pending.'}
      </Text>
      {apiBaseUrl ? (
        <Pressable accessibilityRole="button" onPress={() => { setStatus('checking'); setRetryCount((value) => value + 1) }}>
          <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">Retry connection</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
