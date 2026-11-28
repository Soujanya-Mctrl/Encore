import { useCallback, useEffect, useState } from 'react'
import { useEncoreAccount } from '@/features/music/account'
import { encoreApiFetch } from '@/lib/api-client'

export type EncorePortfolio = {
  user: { id: string; displayName: string; roles: string[] }
  wallets: { id: string; address: string; chain: string; isPrimary: boolean }[]
  passes: { id: string; seriesId: string; trackId: string; serial: number; status: string; listingPriceSmallestUnits: string | null }[]
  receipts: { id: string; trackId: string; passportVersion: number; amountSmallestUnits: string; signature: string; createdAt: string }[]
  spotListings: { id: string; campaignId: string; remainingUnits: number; unitPriceSmallestUnits: string; active: boolean }[]
  shareBalances: { campaignId: string; campaignTitle: string; units: number }[]
}

export function useEncorePortfolio() {
  const { account, token, signIn } = useEncoreAccount()
  const [portfolio, setPortfolio] = useState<EncorePortfolio | null>(null)
  const [loading, setLoading] = useState(Boolean(account))
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!account) { setPortfolio(null); setLoading(false); return }
    setLoading(true); setError('')
    try { setPortfolio(await encoreApiFetch<EncorePortfolio>('/api/v1/portfolio', { bearerToken: token, cache: 'no-store' })) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not load portfolio') }
    finally { setLoading(false) }
  }, [account, token])
  useEffect(() => { void refresh() }, [refresh])
  return { portfolio, loading, error, refresh, account, signIn, token }
}
