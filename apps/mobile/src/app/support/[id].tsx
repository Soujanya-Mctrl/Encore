import Ionicons from '@expo/vector-icons/Ionicons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { tracks } from '@/features/encore/fixtures'
import { AlbumArt } from '@/features/encore/ui/album-art'
import { encoreColors as c } from '@/features/encore/ui/tokens'

const amounts = [5, 10, 25] as const

export default function SupportCheckout() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [amount, setAmount] = useState<number | 'custom'>(5)
  const [customAmount, setCustomAmount] = useState('')
  const track = tracks.find((item) => item.id === id)
  const entered = amount === 'custom' ? customAmount.trim() : String(amount)
  const [whole, fraction = ''] = entered.split('.')
  const units = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(entered)
    ? BigInt(whole + fraction.padEnd(6, '0'))
    : 0n
  const valid = units > 0n
  const displayAmount = valid ? `${whole}.${fraction.padEnd(2, '0')}` : '—'

  if (!track) return <View style={{ flex: 1, backgroundColor: c.bg, padding: 24 }}><Text style={{ color: c.ink }}>Track not found.</Text></View>

  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 56, gap: 24 }} keyboardShouldPersistTaps="handled">
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Close checkout" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: c.oat, borderWidth: 1, borderColor: c.border }}>
        <Ionicons name="arrow-back" size={22} color={c.ink} />
      </Pressable>
      <Text style={{ color: c.ink, fontSize: 21, fontWeight: '700' }}>Support artist</Text>
      <View style={{ flex: 1 }} />
      <View style={{ backgroundColor: c.paleTeal, borderWidth: 1, borderColor: c.berry, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: c.berry, fontWeight: '700', fontSize: 12 }}>● Devnet</Text>
      </View>
    </View>

    <View style={{ gap: 5 }}>
      <Text style={{ color: c.ink, fontSize: 29, fontWeight: '800', letterSpacing: -0.5 }}>Review your support</Text>
      <Text style={{ color: c.muted, fontSize: 15, lineHeight: 21 }}>Choose an amount for the artist behind this track.</Text>
    </View>

    <View style={{ backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
      <AlbumArt track={track} size={70} radius={14} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>{track.title}</Text>
        <Text style={{ color: c.muted, fontSize: 14 }}>{track.artist}</Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>Sample Music Passport · version unavailable</Text>
      </View>
    </View>

    <View style={{ gap: 12 }}>
      <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700' }}>Direct support amount</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {amounts.map((value) => {
          const isSelected = amount === value
          return (
            <Pressable key={value} onPress={() => setAmount(value)} accessibilityRole="button" accessibilityState={{ selected: isSelected }} style={{ flex: 1, minWidth: 74, minHeight: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: isSelected ? c.berry : c.oat, borderWidth: 1, borderColor: isSelected ? c.berry : c.border }}>
              <Text style={{ color: isSelected ? c.berryDark : c.ink, fontWeight: '700', fontSize: 16 }}>{value} USDC</Text>
            </Pressable>
          )
        })}
        <Pressable onPress={() => setAmount('custom')} accessibilityRole="button" accessibilityState={{ selected: amount === 'custom' }} style={{ flex: 1, minWidth: 74, minHeight: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: amount === 'custom' ? c.berry : c.oat, borderWidth: 1, borderColor: amount === 'custom' ? c.berry : c.border }}>
          <Text style={{ color: amount === 'custom' ? c.berryDark : c.ink, fontWeight: '700', fontSize: 16 }}>Custom</Text>
        </Pressable>
      </View>
      {amount === 'custom' && (
        <TextInput value={customAmount} onChangeText={setCustomAmount} keyboardType="decimal-pad" placeholder="Amount in test USDC" placeholderTextColor={c.muted} accessibilityLabel="Custom support amount in test USDC" style={{ minHeight: 52, backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, color: c.ink, fontSize: 16 }} />
      )}
      {amount === 'custom' && customAmount.length > 0 && !valid && (
        <Text style={{ color: '#F87171' }}>Enter a positive amount with up to 6 decimal places.</Text>
      )}
    </View>

    <View style={{ backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 18, gap: 16 }}>
      <Text style={{ color: c.ink, fontSize: 19, fontWeight: '700' }}>Payment breakdown</Text>
      <Row label="Direct tip to artist" value={`${displayAmount} test USDC`} />
      <Row label="Platform fee (0%)" value="0.00 test USDC" />
      <Row label="Network fee" value="Shown by wallet" />
      <View style={{ height: 1, backgroundColor: c.border }} />
      <Row label="Total support" value={`${displayAmount} test USDC`} strong />
      <Text style={{ color: c.berry, lineHeight: 19, fontSize: 13 }}>100% of the tip goes to the artist when a valid on-chain checkout is available.</Text>
    </View>
  </ScrollView>
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: strong ? c.ink : c.muted, fontWeight: strong ? '700' : '500', fontSize: strong ? 16 : 14 }}>{label}</Text>
      <Text style={{ color: strong ? c.berry : c.ink, fontWeight: strong ? '800' : '600', fontSize: strong ? 17 : 14 }}>{value}</Text>
    </View>
  )
}
