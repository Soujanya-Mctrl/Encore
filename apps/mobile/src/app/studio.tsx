import Ionicons from '@expo/vector-icons/Ionicons'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { Link, useRouter } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export default function ArtistStudio() {
  const router = useRouter()
  const { account } = useMobileWallet()
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 64, gap: 22 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={{ width: 44, height: 44, justifyContent: 'center' }}>
        <Ionicons name="arrow-back" size={24} color={c.ink} />
      </Pressable>
      <Text style={{ color: c.ink, fontSize: 22, fontWeight: '800' }}>Artist studio</Text>
    </View>
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.muted, letterSpacing: 1, fontSize: 12, fontWeight: '700' }}>RELEASES & PROVENANCE</Text>
      <Text style={{ color: c.ink, fontSize: 29, fontWeight: '800' }}>Own your story</Text>
      <Text style={{ color: c.muted, lineHeight: 21 }}>Publish a versioned Music Passport and give listeners clear context about your work.</Text>
    </View>
    {!account && (
      <View style={{ backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 18, gap: 10 }}>
        <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }}>Connect your artist wallet</Text>
        <Text style={{ color: c.muted, lineHeight: 20 }}>Wallet identity is needed before a release or appeal can be submitted.</Text>
        <Link href="/wallet" asChild>
          <Pressable style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: c.berry, fontWeight: '700' }}>Open wallet →</Text>
          </Pressable>
        </Link>
      </View>
    )}
    <View style={{ flexDirection: 'row', backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 18 }}>
      <Stat value="0" label="Your releases" />
      <Stat value="0" label="Open appeals" />
      <Stat value="—" label="Revenue" />
    </View>
    <View style={{ gap: 10 }}>
      <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700' }}>Your releases</Text>
      <View style={{ backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 22, gap: 8, alignItems: 'center' }}>
        <Ionicons name="albums-outline" size={32} color={c.berry} />
        <Text style={{ color: c.ink, fontWeight: '700', fontSize: 17 }}>No artist releases linked</Text>
        <Text style={{ color: c.muted, textAlign: 'center', lineHeight: 20 }}>When your wallet owns a published passport, its status, version history, and revenue will appear here.</Text>
      </View>
    </View>
    <Link href="/rights" asChild>
      <Pressable style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: c.berry, fontWeight: '700' }}>Manage rights and licensing</Text>
      </Pressable>
    </Link>
    <View style={{ backgroundColor: c.oat, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, gap: 7 }}>
      <Text style={{ color: c.ink, fontWeight: '700' }}>Release editor & appeals</Text>
      <Text style={{ color: c.muted, lineHeight: 20 }}>Submission, evidence upload, version signing, and appeal tracking will become available when artist APIs are connected. No changes can be submitted from this preview.</Text>
    </View>
  </ScrollView>
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={{ color: c.ink, fontWeight: '700', fontSize: 19 }}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{label}</Text>
    </View>
  )
}
