export interface PkceEntry {
  userId: string;
  roles: readonly string[];
  codeChallenge: string;
  redirectUri: string;
  expiresAt: number;
}

const globalPkce = globalThis as unknown as {
  __encorePkceStore?: Map<string, PkceEntry>;
};

export const pkceStore = (globalPkce.__encorePkceStore ??= new Map<string, PkceEntry>());
