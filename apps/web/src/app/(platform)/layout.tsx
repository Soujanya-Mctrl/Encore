import type { ReactNode } from "react";
import { PreviewProvider } from "@/features/player/player";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <PreviewProvider><div className="pb-28">{children}</div></PreviewProvider>;
}
