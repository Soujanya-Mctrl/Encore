# Encore Mobile

This native Android Expo app was scaffolded with the official Solana Mobile `expo-kit-wallet` template. The template supplies Mobile Wallet Adapter connection, signing, and a sample Memo transaction. Encore payments and passports are not wired yet.

## Encore local setup

1. Install Node.js 22.12+, pnpm 9.15.0, JDK 17, Android Studio, the Android SDK, and an Android emulator with an MWA compatible wallet.
2. From the repository root, run `pnpm install`.
3. Copy `apps/mobile/.env.example` to `apps/mobile/.env.local`. The Android emulator uses `10.0.2.2` to reach the development machine; a physical device needs a reachable LAN or HTTPS API URL.
4. Start the backend with `pnpm dev` from the repository root.
5. From `apps/mobile`, run `pnpm android` to compile and install the development build. Expo Go cannot run the native wallet modules.

The Wallet tab checks `GET /api/v1/health` from the device and expects `status: "ok"` with `cluster: "devnet"`. The current backend supports identity and onboarding only. Catalog, passport, and payment endpoints remain integration gates.

`@encore/contracts` and pure `@encore/core` are workspace dependencies. Expo and wallet SDKs stay in the mobile app. Never put a Supabase service-role key, session secret, or provider API key in an `EXPO_PUBLIC_` variable.

## Template reference

This is an [Expo](https://expo.dev) development-client app template for Solana Mobile wallets. It uses
[@solana/kit](https://www.solanakit.com/) and [@wallet-ui/react-native-kit](https://wallet-ui.dev/) to connect to a
mobile wallet, read account state, and run example wallet actions.

## Technologies

- [@solana/kit](https://www.solanakit.com/)
- [@wallet-ui/react-native-kit](https://wallet-ui.dev/)
- [Expo](https://expo.dev)
- [HeroUI Native](https://heroui.com/docs/native)
- [Uniwind](https://uniwind.dev/) (Tailwind CSS for React Native)

## Included wallet flows

- Connect and disconnect a mobile wallet.
- Read the connected account balance and recent activity for the selected cluster.
- Show the connected wallet's primary `.skr` domain and a "Seeker verified" badge when it holds a Seeker Genesis Token.
- Sign a message with the connected account.
- Sign a memo transaction.
- Sign a Solana Sign-In payload.
- Sign and submit a memo transaction after checking the connected account can pay the transaction fee.

## Get started

1. Install dependencies.

   ```bash
   npm install
   ```

2. Build and run the Android development client.

   ```bash
   npm run android
   ```

This template depends on native modules and `expo-dev-client`, so use a development build instead of Expo Go.

You can start developing by editing the files inside the `src` directory. Expo Router routes live in `src/app`, and
feature code lives in `src/features`.

## Wallet and network notes

- Devnet and Testnet have default RPC URLs. Localhost and Mainnet are disabled until you add an RPC URL in
  Settings > Cluster.
- The `.skr` domain and Seeker Genesis Token lookups always read from mainnet through the public
  `https://api.mainnet-beta.solana.com` RPC, whichever cluster is selected.
- The app asks the selected mobile wallet to approve connection, message signing, sign-in, transaction signing, and
  transaction submission requests.
- The sign-and-send demo creates a Memo Program transaction with the text entered in the app. It checks the wallet
  balance for the estimated fee before submitting.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Solana documentation](https://solana.com/docs): Learn how to build on Solana.
- [Solana Kit documentation](https://www.solanakit.com/): Learn how to use the JavaScript SDK for Solana.
- [Uniwind documentation](https://uniwind.dev/): Learn how to style your app with Tailwind CSS.
- [Wallet UI documentation](https://wallet-ui.dev/): Learn how to build wallet-enabled Solana apps on web and mobile.
