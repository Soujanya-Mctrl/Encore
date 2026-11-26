// Enforces clean architecture dependency boundaries across the monorepo.
export const coreBoundaryRule = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        "@encore/infrastructure*",
        "@supabase/*",
        "@solana/*",
        "next/*",
        "elevenlabs*",
        "@mendable/firecrawl-js*"
      ]
    }
  ]
};
