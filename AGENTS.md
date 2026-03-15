# AGENTS.md

## Build & Deployment Commands

### Monorepo Root
```bash
pnpm dev              # Start both frontend and data-service in dev mode
pnpm build-package    # Build @repo/data-ops package only
pnpm deploy:all       # Deploy both services after building package
```

### User Application (Frontend)
```bash
pnpm --filter user-application dev          # Start Vite dev server on port 3000
pnpm --filter user-application build        # Build for production
pnpm --filter user-application deploy       # Deploy to Cloudflare Workers
pnpm --filter user-application cf-typegen   # Generate TypeScript bindings
```

### Data Service (Backend)
```bash
pnpm --filter data-service dev            # Start Wrangler dev server
pnpm --filter data-service build          # Build for production
pnpm --filter data-service deploy:stage   # Deploy to stage environment
pnpm --filter data-service deploy:production  # Deploy to production
pnpm --filter data-service cf-typegen     # Generate TypeScript bindings
```

### Data Ops (Shared Package)
```bash
pnpm --filter @repo/data-ops pull         # Pull D1 schema from Cloudflare
pnpm --filter @repo/data-ops migrate      # Run migrations
pnpm --filter @repo/data-ops generate     # Generate Drizzle schema
pnpm --filter @repo/data-ops studio       # Open Drizzle Studio
pnpm --filter @repo/data-ops build        # Build package to dist/
```

### Testing
```bash
pnpm --filter user-application test       # Run vitest (no config, uses defaults)
pnpm --filter data-service test           # Run vitest with Workers pool
pnpm --filter data-service test -- --watch    # Watch mode
pnpm --filter data-service test -- --coverage # With coverage
```

**Note:** Test files should be named `*.test.ts` or `*.spec.ts` and use Vitest with `@cloudflare/vitest-pool-workers`.

---

## Code Style Guidelines

### General
- **Language:** TypeScript (strict mode enabled)
- **Module System:** ESNext with ESM
- **Target:** ES2021 for data-service, ES2022 for user-application
- **Line Length:** 140 characters (per .prettierrc)
- **Quotes:** Single quotes
- **Semicolons:** Required
- **Indentation:** Tabs (per .prettierrc)

### Imports
- Use absolute paths with `@/` alias:
  - `@/*` resolves to `src/*` in data-service and data-ops
  - `@/worker/*` resolves to `worker/*` in user-application
  - `@/bindings` resolves to service-bindings.d.ts
- Import order: external libs → internal packages (e.g., `@repo/data-ops`) → local paths
- Use named imports when possible; avoid default imports for libraries
- Group imports with blank lines between categories

### Naming Conventions
- **Files:** kebab-case for components (e.g., `link-name-editor.tsx`), PascalCase for utilities
- **Variables/Functions:** camelCase (e.g., `getRoutingDestinations`, `handleLinkClick`)
- **Types/Interfaces:** PascalCase with descriptive names (e.g., `DestinationStatusEvaluationParams`, `GeoClick`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `TTL_TIME_ONE_DAY`)
- **Classes:** PascalCase (e.g., `DataService`, `LinkClickTracker`, `DestinationEvaluationWorkflow`)
- **Zod Schemas:** camelCase with type suffix (e.g., `linkSchema`, `cloudflareInfoSchema`, `destinationsSchema`)

### TypeScript
- Enable all strict mode options: `strict`, `noUnusedLocals`, `noUnusedParameters`
- Use `type` for object shapes, `interface` for class definitions
- Define types in the same file or in dedicated `types.ts` files
- Use `z.infer<typeof schema>` to extract Zod schema types
- Export types from `@repo/data-ops/zod-schema/*` for reuse

### Error Handling
- Use Zod's `.safeParse()` for validation errors (non-throwing)
- Log errors with context: `console.error('[module] message', error)`
- Return user-friendly error messages in HTTP responses
- Use try-catch for async operations that may fail gracefully

### Components (User Application)
- Use React functional components with explicit props typing
- Follow component composition: `ComponentName.tsx` exports `{ ComponentName, componentVariants }`
- Use Radix UI primitives for accessible components
- Use Tailwind CSS with `cn()` utility from `@/lib/utils`
- Component props should be typed with `React.ComponentProps<"element">`

### Cloudflare Workers Patterns
- Use `WorkerEntrypoint` class for main worker entry points
- Use `Hono` for routing (export as `App`)
- Access environment via `env` parameter (typed in `service-bindings.d.ts`)
- Use `waitUntil()` for non-blocking operations (queues, analytics)
- Use Durable Objects for stateful, low-latency data
- Use Workflows for multi-step async operations with retries

### Database & Data Access
- Use Drizzle ORM for D1 database queries
- Place queries in `packages/data-ops/src/queries/*.ts`
- Export via package.json `exports` field
- Use Zod schemas for query parameters and response validation
- Durable Objects use SQLite storage via `ctx.storage.sql`

### Zod Schema Patterns
- Validate Cloudflare request headers with safeParse:
  ```typescript
  const cfHeader = cloudflareInfoSchema.safeParse(c.req.raw.cf);
  if (cfHeader.success === false) {
    return c.text('Invalid CF header', 400);
  }
  ```
- Use `.transform()` for type conversions (e.g., string → number)
- Define input schemas with `.omit()` for create/update operations

### Testing
- Use Vitest with `@cloudflare/vitest-pool-workers`
- Environment bindings defined in `test/env.d.ts`
- Test files: `*.test.ts` or `*.spec.ts`
- Mock Cloudflare bindings as needed
- Focus on integration tests for Workers logic

---

## Project Structure

```
packages/
  data-ops/              # Shared package for database, queries, Zod schemas
    src/
      db/               # Database connection helpers
      queries/          # D1 query functions
      zod/              # Zod validation schemas
      durable-objects-helpers/  # DO utilities
      drizzle-out/      # Auto-generated Drizzle schema
apps/
  user-application/     # Frontend (React + tRPC)
    src/
      components/       # UI components
        ui/            # Radix-based primitives
      hooks/           # React hooks
      lib/             # Utilities (cn, formatting)
    worker/            # Cloudflare Worker backend
      trpc/            # tRPC routers and context
  data-service/        # Backend (Hono + Cloudflare primitives)
    src/
      helpers/         # Business logic helpers
      queue-handlers/  # Queue message handlers
      workflows/       # Cloudflare Workflows
      durable-objects/ # Durable Object classes
wrangler.jsonc         # Cloudflare Worker configuration (per app)
```

---

## Environment Variables & Bindings

### User Application (wrangler.jsonc)
- `VITE_BACKEND_HOST`: Data service URL
- `GOOGLE_CLIENT_ID`, `STRIPE_*`: Auth/payment config

### Data Service (wrangler.jsonc)
- `DB`: D1 database binding
- `QUEUE`: Queue producer/consumer bindings
- `EVALUATION_SCHEDULER`, `LINK_CLICK_TRACKER_OBJECT`: Durable Object bindings
- `BUCKET`: R2 storage for evaluations
- `AI`, `VIRTUAL_BROWSER`: Cloudflare AI and Puppeteer bindings

Generate types with: `pnpm cf-typegen`

---

## Key Libraries
- **Backend:** Hono, Cloudflare Workers, Drizzle ORM
- **Frontend:** React 19, TanStack Router, tRPC, Radix UI
- **Validation:** Zod
- **Auth:** Better Auth with Google + Stripe integration
- **Testing:** Vitest with Cloudflare Workers pool

---

## CI/CD Notes
- Deploy stage: `pnpm deploy:stage:data-service` or `deploy:stage:user-application`
- Deploy production: `pnpm deploy:production:data-service` or `deploy:production:user-application`
- Always run `build-package` before deploying services that depend on @repo/data-ops
- Check environment-specific bindings in wrangler.jsonc `env` section
