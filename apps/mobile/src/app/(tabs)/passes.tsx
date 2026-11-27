import Ionicons from '@expo/vector-icons/Ionicons'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export default function Passes() {
  const [section, setSection] = useState<'passes' | 'receipts'>('passes')
  const { account } = useMobileWallet()
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 72, gap: 24 }}>
    <View style={{ gap: 5, paddingTop: 12 }}>
      <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>YOUR COLLECTION</Text>
      <Text style={{ color: c.ink, fontSize: 30, fontWeight: '800' }}>Passes & Receipts</Text>
      <Text style={{ color: c.muted, lineHeight: 21 }}>Benefits you own and payments you can verify.</Text>
    </View>
    <View style={{ flexDirection: 'row', backgroundColor: c.oat, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 5 }}>
      {(['passes', 'receipts'] as const).map((value) => {
        const isSelected = section === value
        return (
          <Pressable key={value} onPress={() => setSection(value)} accessibilityRole="tab" accessibilityState={{ selected: isSelected }} style={{ flex: 1, minHeight: 44, backgroundColor: isSelected ? c.berry : 'transparent', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: isSelected ? c.berryDark : c.muted, fontWeight: '700' }}>{value === 'passes' ? 'Active passes' : 'Receipts'}</Text>
          </Pressable>
        )
      })}
    </View>
    <View style={{ backgroundColor: c.white, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 24, alignItems: 'center', gap: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.oat, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={section === 'passes' ? 'ticket-outline' : 'receipt-outline'} size={30} color={c.berry} />
      </View>
      <Text style={{ color: c.ink, fontSize: 21, fontWeight: '700', textAlign: 'center' }}>{account ? section === 'passes' ? 'No passes yet' : 'No receipts yet' : 'Connect a wallet to view your collection'}</Text>
      <Text style={{ color: c.muted, textAlign: 'center', lineHeight: 21 }}>{account ? section === 'passes' ? 'Artist passes will appear here after a confirmed purchase is indexed.' : 'Confirmed support and pass transactions will appear here with Explorer links.' : 'Your passes and receipts are tied to your Solana wallet.'}</Text>
      <Link href={account ? '/discover' : '/wallet'} asChild>
        <Pressable style={{ backgroundColor: c.berry, borderRadius: 16, minHeight: 48, paddingHorizontal: 24, justifyContent: 'center' }}>
          <Text style={{ color: c.berryDark, fontWeight: '800' }}>{account ? 'Discover artists' : 'Open wallet'}</Text>
        </Pressable>
      </Link>
    </View>
    <View style={{ backgroundColor: c.oat, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, flexDirection: 'row', gap: 12 }}>
      <Ionicons name="shield-checkmark-outline" size={23} color={c.berry} />
      <Text style={{ flex: 1, color: c.muted, lineHeight: 21 }}>A receipt will show its transaction signature and the exact Music Passport version used at checkout.</Text>
    </View>
  </ScrollView>
}
