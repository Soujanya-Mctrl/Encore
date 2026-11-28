import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, Text, TextInput, View } from 'react-native'
import { CreateMusicSheet, type AudioFile } from '@/features/studio/create-sheet'
import { studioColors as c } from '@/features/studio/data'
import { StudioCard, StudioPage } from '@/features/studio/ui'
import { useEncoreAccount } from '@/features/music/account'
import { submitStudioUpload } from '@/lib/encore-studio'
import type { ReleaseInput } from '@encore/contracts'

const origins = ['Human-created', 'AI-assisted', 'AI-generated', 'Unknown'] as const

export default function Upload() {
  const router = useRouter()
  const { account, token, signIn } = useEncoreAccount()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [files, setFiles] = useState<AudioFile[]>([])
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [origin, setOrigin] = useState<(typeof origins)[number]>('Unknown')
  const [consent, setConsent] = useState(false)
  const [previewAllowed, setPreviewAllowed] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function createDraft() {
    if (!account) { await signIn(); return }
    if (files.length !== 1 || !files[0] || !title.trim() || !genre.trim() || !consent || !previewAllowed) {
      setError('Choose one audio file, enter the title and genre, and confirm contributor consent and preview permission.')
      return
    }
    const originCategory = origin === 'Human-created' ? 'HUMAN_CREATED'
      : origin === 'AI-assisted' ? 'AI_ASSISTED' : origin === 'AI-generated' ? 'AI_GENERATED' : 'UNKNOWN'
    const mode = origin === 'Human-created' ? 'human'
      : origin === 'AI-assisted' ? 'assisted' : origin === 'AI-generated' ? 'generative_ai' : 'unknown'
    const metadata: ReleaseInput = {
      title: title.trim(), artistName: account.user.displayName, genre: genre.trim(), description: '',
      originCategory, previewConsent: true,
      contributions: [{ role: 'Artist', mode, creatorRef: account.user.id, consent: true }]
    }
    setBusy(true); setError(''); setSuccess('')
    try {
      const result = await submitStudioUpload(files[0].uri, metadata, token)
      setSuccess('Private Music Passport draft created.')
      router.replace(`/studio/release/${result.track.id}`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Upload failed. Try again.')
    } finally { setBusy(false) }
  }

  return (
    <>
      <StudioPage title="New release" back onCreate={() => setPickerOpen(true)}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: c.ink, fontSize: 27, fontWeight: '800' }}>Prepare a release</Text>
          <Text style={{ color: c.muted, lineHeight: 20 }}>
            Create a private draft in your artist account. Uploads are checked before a Passport is created.
          </Text>
        </View>
        <StudioCard>
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: '800' }}>Music file</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPickerOpen(true)}
            style={{
              minHeight: 156,
              borderStyle: 'dashed',
              borderWidth: 2,
              borderColor: c.muted,
              backgroundColor: c.oat,
              borderRadius: 16,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 16,
              gap: 9,
            }}
          >
            <Ionicons name="cloud-upload-outline" size={38} color={c.berry} />
            <Text style={{ color: c.ink, fontWeight: '800' }}>Choose audio files</Text>
            <Text style={{ color: c.muted, textAlign: 'center', fontSize: 12 }}>Select one MP3 up to 20 MB</Text>
          </Pressable>
          {files.map((file, index) => (
            <Text key={`${file.uri}-${index}`} numberOfLines={1} style={{ color: c.berry, fontSize: 13 }}>
              ♪ {file.name}
            </Text>
          ))}
        </StudioCard>
        <StudioCard>
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: '800' }}>Release details</Text>
          <Field label="Track title" value={title} onChangeText={setTitle} placeholder="Name your track" />
          <Field label="Genre" value={genre} onChangeText={setGenre} placeholder="e.g. Indie electronic" />
          <Text style={{ color: c.muted, fontSize: 12 }}>Creation origin</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {origins.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: origin === option }}
                onPress={() => setOrigin(option)}
                style={{
                  minHeight: 42,
                  borderRadius: 21,
                  backgroundColor: origin === option ? c.berry : c.oat,
                  paddingHorizontal: 13,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: origin === option ? c.berryDark : c.ink, fontWeight: '700' }}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </StudioCard>
        <StudioCard>
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: '800' }}>Rights and evidence</Text>
          <Text style={{ color: c.muted, lineHeight: 20 }}>
            Evidence remains unverified until it is submitted and reviewed. It is separate from creation origin.
          </Text>
          <Choice
            title="I have contributor consent for this audio"
            value={consent}
            onPress={() => setConsent(!consent)}
          />
          <Choice
            title="I permit an Encore preview"
            value={previewAllowed}
            onPress={() => setPreviewAllowed(!previewAllowed)}
          />
        </StudioCard>
        <Pressable
          accessibilityRole="button"
          onPress={() => { setShowReview(true); setError(''); setSuccess('') }}
          style={{
            minHeight: 52,
            borderRadius: 15,
            backgroundColor: c.berry,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.berryDark, fontWeight: '800' }}>Review draft</Text>
        </Pressable>
        {showReview && (
          <StudioCard>
            <Text style={{ color: c.ink, fontSize: 17, fontWeight: '800' }}>Draft details</Text>
            <Text style={{ color: c.muted }}>Title: {title.trim() || 'Missing'}</Text>
            <Text style={{ color: c.muted }}>Genre: {genre.trim() || 'Missing'}</Text>
            <Text style={{ color: c.muted }}>Audio files: {files.length}</Text>
            <Text style={{ color: c.muted }}>Origin: {origin}</Text>
            <Text style={{ color: c.muted }}>Evidence: Unverified</Text>
            <Text style={{ color: c.muted }}>
              Preview rights: {previewAllowed ? 'Declared allowed' : 'Not declared'}
            </Text>
            <Text style={{ color: c.muted }}>Contributor consent: {consent ? 'Declared' : 'Not declared'}</Text>
            <Text style={{ color: c.muted, lineHeight: 20 }}>This creates a private draft only. Submission, review and publication are separate steps.</Text>
            {error ? <Text accessibilityRole="alert" style={{ color: '#D4515B' }}>{error}</Text> : null}
            {success ? <Text style={{ color: '#168A58' }}>{success}</Text> : null}
            <Pressable disabled={busy} onPress={() => void createDraft()} style={{ minHeight: 50, borderRadius: 14, backgroundColor: c.berry, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: c.berryDark, fontWeight: '800' }}>{busy ? 'Uploading…' : account ? 'Upload and save private draft' : 'Sign in to upload draft'}</Text>
            </Pressable>
          </StudioCard>
        )}
      </StudioPage>
      <CreateMusicSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onFilesChange={setFiles} />
    </>
  )
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder: string
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        style={{
          minHeight: 48,
          backgroundColor: c.bg,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border,
          color: c.ink,
          paddingHorizontal: 12,
        }}
      />
    </View>
  )
}

function Choice({ title, value, onPress }: { title: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={onPress}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={23} color={value ? c.berry : c.muted} />
      <Text style={{ color: c.ink, flex: 1 }}>{title}</Text>
    </Pressable>
  )
}
