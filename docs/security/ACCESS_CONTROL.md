# Access Control & RBAC Policy

## 1. Roles

| Role | Publicly Assignable? | Access Scope |
| :--- | :--- | :--- |
| `listener` | Yes (default) | Public discovery, onboarding, tipping, supporter passes |
| `artist` | Yes (via onboarding) | Artist Studio (`/studio/dashboard`), track & passport submission |
| `commercial_buyer` | Yes | Commercial licensing portal |
| `reviewer` | **No** (admin-granted only) | Reviewer Queue (`/admin/reviews`), evidence corroboration, dispute triage |
| `admin` | **No** (admin-granted only) | Platform administration & role management |

## 2. Protections Enforced

- `canPubliclyAssignRole()` rejects `reviewer` and `admin` in `POST /api/v1/auth/onboarding`.
- `requireAuthenticatedUser(["artist", "admin"])` gates `/studio/dashboard`.
- `requireAuthenticatedUser(["reviewer", "admin"])` gates `/admin/reviews`.
- `authenticateOrCreateUser()` rejects cross-account wallet binding if a wallet address is already owned by another `userId`.
- All 6 identity tables have Row-Level Security (`RLS`) enabled with zero anonymous public access; `SUPABASE_SERVICE_ROLE_KEY` is strictly server-only.
