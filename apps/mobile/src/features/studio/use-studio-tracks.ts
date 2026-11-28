import { useCallback, useEffect, useState } from 'react'
import type { StudioTrack } from '@encore/contracts'
import { useEncoreAccount } from '@/features/music/account'
import { listStudioTracks } from '@/lib/encore-studio'
import type { StudioRelease } from './data'

const colors = ['#564472', '#A56C58', '#4D6B69', '#7D6379', '#426178']
const labels: Record<string, string> = {
  HUMAN_CREATED: 'Human-created', AI_ASSISTED: 'AI-assisted', AI_GENERATED: 'AI-generated', UNKNOWN: 'Unknown',
  SELF_DECLARED: 'Self-declared', CORROBORATED: 'Corroborated', UNVERIFIED: 'Unverified', DISPUTED: 'Disputed',
  PREVIEW_ALLOWED: 'Preview allowed', EXTERNAL_LICENSE_ONLY: 'External license only',
  COMMERCIAL_CLEARED: 'Commercial cleared', RESTRICTED: 'Restricted'
}

export function toStudioRelease(track: StudioTrack, index = 0): StudioRelease {
  const status: StudioRelease['status'] = track.status === 'published' ? 'Published'
    : track.status === 'rejected' ? 'Needs evidence'
      : track.status === 'draft' ? 'Draft' : 'In review'
  return {
    id: track.id,
    title: track.title,
    kind: 'Single',
    date: new Date(track.createdAt).toLocaleDateString(),
    status,
    origin: labels[track.manifest.originCategory] ?? 'Unknown',
    evidence: labels[track.manifest.evidenceStatus] ?? 'Unverified',
    rights: labels[track.manifest.rightsStatus] ?? 'Unverified',
    color: colors[index % colors.length]!
  }
}

export function useStudioTracks() {
  const { token, account, signIn } = useEncoreAccount()
  const [tracks, setTracks] = useState<StudioTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!account) { setTracks([]); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const result = await listStudioTracks(token)
      setTracks(result.tracks)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load releases')
    } finally { setLoading(false) }
  }, [account, token])
  useEffect(() => { void refresh() }, [refresh])
  return { tracks, releases: tracks.map(toStudioRelease), loading, error, refresh, account, signIn }
}
