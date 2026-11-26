import type { ReactNode } from "react";
import { EncorePollarProvider } from "@/providers/pollar-provider";

export const metadata = {
  title: "Encore — Music Provenance, Discovery & Supporter Economy",
  description:
    "Discover music with accurate creative-origin context and support creators directly on Solana."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#151725] text-slate-100 antialiased">
        <EncorePollarProvider>{children}</EncorePollarProvider>
      </body>
    </html>
  );
}
