import { PkceBrowserRequestSchema } from "@encore/contracts";
import { LoginPanel } from "@/features/auth/login-panel";
import { permitsNativeRedirect } from "@/server/pkce";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { codeChallenge, redirectUri, state } = await searchParams;
  const wantsNativeHandoff = codeChallenge !== undefined || redirectUri !== undefined || state !== undefined;
  const handoff = PkceBrowserRequestSchema.safeParse({ codeChallenge, redirectUri, state });
  const nativeHandoff = handoff.success && permitsNativeRedirect(handoff.data.redirectUri) ? handoff.data : null;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      {wantsNativeHandoff && !nativeHandoff ? (
        <p role="alert">This sign-in request is invalid. Return to the Encore app and start again.</p>
      ) : (
        <LoginPanel
          nativeHandoff={nativeHandoff}
          socialSignInEnabled={process.env.NEXT_PUBLIC_POLLAR_SOCIAL_ENABLED === "1"}
        />
      )}
    </main>
  );
}
