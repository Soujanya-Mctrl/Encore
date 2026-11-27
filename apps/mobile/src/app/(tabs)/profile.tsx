import Ionicons from '@expo/vector-icons/Ionicons'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { Link } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export default function Profile() {
  const { account } = useMobileWallet()
  const address = account?.address
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 72, gap: 22 }}>
    <Text style={{ color: c.ink, fontSize: 29, fontWeight: '800', paddingTop: 12 }}>Your Encore</Text>
    <View style={{ backgroundColor: c.white, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 22, alignItems: 'center', gap: 12 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.oat, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person-outline" size={38} color={c.berry} />
      </View>
      <Text style={{ color: c.ink, fontSize: 23, fontWeight: '700' }}>{account?.label ?? 'Guest listener'}</Text>
      <Text style={{ color: c.muted, textAlign: 'center' }}>{address ? `${address.slice(0, 6)}…${address.slice(-6)}` : 'Connect a wallet to collect passes and support artists.'}</Text>
      <Link href="/wallet" asChild>
        <Pressable style={{ backgroundColor: c.berry, borderRadius: 16, minHeight: 48, minWidth: 180, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: c.berryDark, fontWeight: '800', fontSize: 15 }}>{account ? 'Manage wallet' : 'Connect wallet'}</Text>
        </Pressable>
      </Link>
    </View>
    <View style={{ flexDirection: 'row', backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 18 }}>
      <Stat value="—" label="Passes" />
      <Stat value="—" label="Receipts" />
      <Stat value="Devnet" label="Network" />
    </View>
    <View style={{ gap: 10 }}>
      <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700' }}>Your account</Text>
      <Menu href="/passes" icon="ticket-outline" title="Passes & receipts" />
      <Menu href="/studio" icon="musical-notes-outline" title="Artist studio" />
      <Menu href="/settings" icon="options-outline" title="Settings & network" />
      <Menu href="/tools" icon="construct-outline" title="Wallet tools" />
      <Menu href="/onboarding" icon="book-outline" title="Welcome guide" />
    </View>
    <Text style={{ color: c.muted, textAlign: 'center', fontSize: 12 }}>Encore mobile · Solana Devnet</Text>
  </ScrollView>
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={{ color: c.ink, fontWeight: '700', fontSize: 19 }}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
    </View>
  )
}

function Menu({ href, icon, title }: { href: '/passes' | '/studio' | '/settings' | '/tools' | '/onboarding'; icon: React.ComponentProps<typeof Ionicons>['name']; title: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={{ minHeight: 58, backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Ionicons name={icon} size={22} color={c.berry} />
        <Text style={{ flex: 1, color: c.ink, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        <Ionicons name="chevron-forward" size={20} color={c.muted} />
      </Pressable>
    </Link>
  )
}
