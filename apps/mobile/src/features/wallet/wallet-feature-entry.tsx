import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { ShellUiPage } from '@/features/shell/ui/shell-ui-page'
import { EncoreApiStatus } from '@/features/encore/encore-api-status'
import { WalletFeatureConnected } from '@/features/wallet/wallet-feature-connected'
import { WalletUiConnectButton } from '@/features/wallet/ui/wallet-ui-connect-button'
import { Text, View } from 'react-native'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export function WalletFeatureEntry() {
  const wallet = useMobileWallet()
  const { account, connect } = wallet

  return (
    <ShellUiPage>
      <View style={{ gap: 7, paddingVertical: 16 }}><Text style={{ color: c.muted, fontSize: 12, letterSpacing: 1, fontWeight: '700' }}>SOLANA DEVNET</Text><Text style={{ color: c.ink, fontSize: 30, fontWeight: '700' }}>Your wallet</Text><Text style={{ color: c.muted, lineHeight: 21 }}>Connect to support artists and hold verifiable passes. Every payment requires your approval.</Text></View>
      <EncoreApiStatus />
      {account ? (
        <WalletFeatureConnected account={account} wallet={wallet} />
      ) : (
        <WalletUiConnectButton connect={connect} size="lg">
          Connect Wallet
        </WalletUiConnectButton>
      )}
    </ShellUiPage>
  )
}
