# Auth Skill

## Overview

Authentication is handled by **[better-auth](https://better-auth.com/)** (v1.3.4). The app currently supports **Google OAuth** as the only sign-in provider. The auth flow is split between a frontend client and a backend worker.

---

## Frontend

### Auth Client

**File:** `apps/user-application/src/components/auth/client.ts`

```ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();
```

This creates a typed auth client that communicates with the better-auth backend endpoints (mounted at `/api/auth` by default). Import and use `authClient` anywhere in the frontend to interact with auth.

### Signing In (Google OAuth)

Use `authClient.signIn.social` to trigger a social login redirect:

```ts
import { authClient } from "@/components/auth/client";

await authClient.signIn.social({
  provider: "google",
  callbackURL: "/app", // where to redirect after successful login
});
```

This is used in `src/components/auth/login-popup.tsx`. The `LoginPopup` component wraps any trigger element and shows a dialog with a "Continue with Google" button.

> **Note:** `login-popup.tsx` currently uses a **mock** `authClient` (with a fake `signIn.social` that only logs). To wire up real auth, replace the local mock with the import from `@/components/auth/client`.

### Reading the Current Session

Use `authClient.useSession()` (a React hook) to get the current user session reactively:

```ts
import { authClient } from "@/components/auth/client";

const { data, isPending } = authClient.useSession();

if (isPending) return <Spinner />;
if (!data) return <LoginButton />;

console.log(data.user.name, data.user.email, data.user.image);
```

This is used in `src/components/auth/user-icon.tsx` to display the logged-in user's avatar and email in the header.

### Signing Out

```ts
import { authClient } from "@/components/auth/client";

await authClient.signOut();
```

### Protected Routes

Protected pages live under `src/routes/app/_authed/`. The `_authed` layout route (`src/routes/app/_authed.tsx`) wraps all authenticated pages with the sidebar and header shell. Any route added inside `_authed/` is automatically part of the authenticated section.

To add auth gating (redirect unauthenticated users), add a `beforeLoad` guard to the `_authed` route:

```ts
// src/routes/app/_authed.tsx
export const Route = createFileRoute("/app/_authed")({
  beforeLoad: async ({ context }) => {
    const session = await authClient.getSession();
    if (!session?.data) throw redirect({ to: "/" });
  },
  component: RouteComponent,
});
```

---

## Backend (Worker / tRPC)

### Worker Entry Point

**File:** `apps/user-application/worker/index.ts`

The Cloudflare Worker handles all requests. tRPC is mounted at `/trpc`. Better-auth's own HTTP handler should be mounted at `/api/auth` (not yet wired — see TODO below).

### tRPC Context

**File:** `apps/user-application/worker/trpc/context.ts`

The context is created per-request and passed to every tRPC procedure. Currently the `userInfo` is **hardcoded**:

```ts
return {
  req,
  env,
  workerCtx,
  userInfo: {
    userId: "1234567890", // TODO: replace with real session from better-auth
  },
};
```

### How to Wire Real Auth into tRPC Context

To extract the real user from the session cookie in the worker:

1. Initialize the better-auth server instance in the worker (requires a `betterAuth({ ... })` config with your DB, Google client ID/secret, etc.).
2. Call `auth.api.getSession({ headers: req.headers })` inside `createContext`.
3. Attach the result to the context.

```ts
// worker/trpc/context.ts (target state)
import { auth } from "../auth"; // your better-auth server instance

export async function createContext({ req, env, workerCtx }) {
  const session = await auth.api.getSession({ headers: req.headers });
  return {
    req,
    env,
    workerCtx,
    userInfo: session
      ? { userId: session.user.id, user: session.user }
      : null,
  };
}
```

### Protecting tRPC Procedures

Use a protected procedure that throws if there is no authenticated user:

```ts
// worker/trpc/trpc-instance.ts
import { TRPCError } from "@trpc/server";

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userInfo) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userInfo: ctx.userInfo } });
});
```

Then use `protectedProcedure` instead of `t.procedure` in any router that requires authentication:

```ts
// worker/trpc/routers/links.ts
import { protectedProcedure } from "../trpc-instance";

export const linksRouter = t.router({
  activeLinks: protectedProcedure.query(async ({ ctx }) => {
    const { userId } = ctx.userInfo;
    // ...
  }),
});
```

---

## Key Files Reference

| Purpose | Path |
|---|---|
| Frontend auth client | `src/components/auth/client.ts` |
| Login dialog (Google OAuth) | `src/components/auth/login-popup.tsx` |
| User avatar / session display | `src/components/auth/user-icon.tsx` |
| Authenticated layout route | `src/routes/app/_authed.tsx` |
| tRPC context (userId) | `worker/trpc/context.ts` |
| tRPC instance & procedures | `worker/trpc/trpc-instance.ts` |
| Worker entry (request routing) | `worker/index.ts` |

---

## Current State vs. Target State

| Area | Current State | Target State |
|---|---|---|
| `login-popup.tsx` auth client | Mock (fake, logs only) | Use real `authClient` from `client.ts` |
| tRPC `userId` | Hardcoded `"1234567890"` | Extracted from better-auth session cookie |
| better-auth server handler | Not mounted in worker | Mount at `/api/auth` in `worker/index.ts` |
| Route auth guard | No redirect for unauthenticated users | `beforeLoad` guard on `_authed` route |
