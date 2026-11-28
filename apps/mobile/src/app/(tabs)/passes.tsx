import Ionicons from '@expo/vector-icons/Ionicons'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { encoreColors as c } from '@/features/encore/ui/tokens'
import { useEncorePortfolio } from '@/features/marketplace/useEncorePortfolio'

export default function Passes() {
  const [section, setSection] = useState<'passes' | 'receipts'>('passes')
  const { account, portfolio, loading, error, refresh, signIn } = useEncorePortfolio()
  const ownedPasses = portfolio?.passes.filter((pass) => ['OWNED', 'LISTED'].includes(pass.status)) ?? []
  const receipts = portfolio?.receipts ?? []
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
    {!account ? <Pressable onPress={() => void signIn()} style={{ backgroundColor: c.white, borderRadius: 20, padding: 24, alignItems: 'center' }}><Text style={{ color: c.berry, fontWeight: '800' }}>Sign in to load your collection</Text></Pressable> : null}
    {account && loading ? <Text style={{ color: c.muted }}>Loading passes and receipts…</Text> : null}
    {account && error ? <Pressable onPress={() => void refresh()}><Text style={{ color: '#D4515B' }}>{error} · Tap to retry</Text></Pressable> : null}
    {section === 'passes' && ownedPasses.map((pass) => <Link href={`/track/${pass.trackId}`} key={pass.id} asChild><Pressable style={{ backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, gap: 5 }}><Text style={{ color: c.ink, fontWeight: '800' }}>Supporter Pass #{pass.serial}</Text><Text style={{ color: c.muted }}>Status: {pass.status} · Track {pass.trackId}</Text>{pass.listingPriceSmallestUnits ? <Text style={{ color: c.berry }}>Listed for {(Number(pass.listingPriceSmallestUnits) / 1_000_000).toFixed(2)} test USDC</Text> : null}</Pressable></Link>)}
    {section === 'receipts' && receipts.map((receipt) => <View key={receipt.id} style={{ backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, gap: 5 }}><Text style={{ color: c.ink, fontWeight: '800' }}>Support receipt</Text><Text style={{ color: c.muted }}>Passport v{receipt.passportVersion} · {(Number(receipt.amountSmallestUnits) / 1_000_000).toFixed(2)} test USDC</Text><Text selectable style={{ color: c.muted, fontSize: 11 }}>{receipt.signature}</Text><Link href={`https://explorer.solana.com/tx/${receipt.signature}?cluster=devnet`}><Text style={{ color: c.berry, fontWeight: '700' }}>View on Solana Explorer →</Text></Link></View>)}
    {account && !loading && !error && !(section === 'passes' ? ownedPasses.length : receipts.length) ? <View style={{ backgroundColor: c.white, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 24, alignItems: 'center', gap: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.oat, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={section === 'passes' ? 'ticket-outline' : 'receipt-outline'} size={30} color={c.berry} />
      </View>
      <Text style={{ color: c.ink, fontSize: 21, fontWeight: '700', textAlign: 'center' }}>{section === 'passes' ? 'No passes yet' : 'No receipts yet'}</Text>
      <Text style={{ color: c.muted, textAlign: 'center', lineHeight: 21 }}>{section === 'passes' ? 'Passes appear here after a confirmed purchase is indexed.' : 'Confirmed support and pass transactions appear here with Explorer links.'}</Text>
      <Link href="/discover" asChild>
        <Pressable style={{ backgroundColor: c.berry, borderRadius: 16, minHeight: 48, paddingHorizontal: 24, justifyContent: 'center' }}>
          <Text style={{ color: c.berryDark, fontWeight: '800' }}>Discover artists</Text>
        </Pressable>
      </Link>
    </View> : null}
    <View style={{ backgroundColor: c.oat, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, flexDirection: 'row', gap: 12 }}>
      <Ionicons name="shield-checkmark-outline" size={23} color={c.berry} />
      <Text style={{ flex: 1, color: c.muted, lineHeight: 21 }}>A receipt will show its transaction signature and the exact Music Passport version used at checkout.</Text>
    </View>
  </ScrollView>
}
