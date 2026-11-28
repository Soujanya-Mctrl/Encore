import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { studioColors as c } from './data'

export type AudioFile = { name: string; size?: number; uri: string }

export function CreateMusicSheet({
  visible,
  onClose,
  onFilesChange,
}: {
  visible: boolean
  onClose: () => void
  onFilesChange?: (files: AudioFile[]) => void
}) {
  const insets = useSafeAreaInsets()
  const [files, setFiles] = useState<AudioFile[]>([])
  const [error, setError] = useState<string | null>(null)
  async function selectFiles() {
    try {
      setError(null)
      let DocumentPicker: any
      try {
        DocumentPicker = await import('expo-document-picker')
      } catch {
        setError('Document picker native module is not available in this client build.')
        return
      }

      if (!DocumentPicker?.getDocumentAsync) {
        setError('Document picker is unavailable in this build.')
        return
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: true,
        copyToCacheDirectory: true,
      })
      if (!result.canceled) {
        const next = [...files, ...result.assets.map(({ name, size, uri }: any) => ({ name, size, uri }))]
        setFiles(next)
        onFilesChange?.(next)
      }
    } catch {
      setError('Could not open audio files. Try again.')
    }
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000000B3' }}>
        <Pressable accessibilityLabel="Close upload sheet" onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            maxHeight: '85%',
            backgroundColor: c.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderColor: c.border,
            borderWidth: 1,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 20),
          }}
        >
          <View
            style={{
              width: 42,
              height: 5,
              backgroundColor: c.muted,
              borderRadius: 3,
              alignSelf: 'center',
              marginBottom: 18,
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 25, fontWeight: '800' }}>Add music files</Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>Select audio for a new release</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="close" color={c.ink} size={24} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
            <Pressable
              onPress={() => void selectFiles()}
              accessibilityRole="button"
              style={{
                minHeight: 210,
                borderStyle: 'dashed',
                borderWidth: 2,
                borderColor: c.muted,
                borderRadius: 20,
                backgroundColor: c.oat,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
                gap: 12,
              }}
            >
              <Ionicons name="cloud-upload-outline" size={52} color={c.berry} />
              <Text style={{ color: c.ink, fontWeight: '700', fontSize: 18, textAlign: 'center' }}>
                Choose audio files
              </Text>
              <Text style={{ color: c.muted, textAlign: 'center', lineHeight: 20 }}>
                Pick files from your device. Audio formats supported by Android&apos;s file picker.
              </Text>
            </Pressable>
            {files.map((file, index) => (
              <View
                key={`${file.uri}-${index}`}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Ionicons name="musical-note" size={22} color={c.berry} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontWeight: '700' }} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>
                    {file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Local audio file'}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`Remove ${file.name}`}
                  onPress={() => {
                    const next = files.filter((_, itemIndex) => itemIndex !== index)
                    setFiles(next)
                    onFilesChange?.(next)
                  }}
                  style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Ionicons name="close-circle-outline" size={22} color={c.muted} />
                </Pressable>
              </View>
            ))}
            {error && <Text style={{ color: '#F87171' }}>{error}</Text>}
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              Selected files are kept locally for this session. Nothing is uploaded, published, or signed yet.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
