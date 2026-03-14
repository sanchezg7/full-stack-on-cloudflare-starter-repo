import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/worker/trpc/router.ts";
import { createContext } from "@/worker/trpc/context";
import { getAuth } from "@repo/data-ops/auth";

export const App = new Hono<{ Bindings: ServiceBindings, Variables: { userId: string }}>();

const getAuthInstance = (env: Env) => {
    // this is where you can add provider details, as needed, when you add new ones.
    return getAuth({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET
    },
    {
        // this allows to process inside of app (for now I used the `stripe listen --forward-to localhost:3000/api/auth/stripe/webhook` and used web secret there)
        stripeWebhookSecret: env.STRIPE_WEBHOOK_KEY,
        stripeApiKey: env.STRIPE_SECRET_KEY,
        // prices from products will go here. Better auth will grab these price details. You could save this in the DB to fetch for more scalable solution
        // check out docs for more dynamic pricing and quanitites of prices. You can also do free trial. Can do annual discounts. Check out better auth docs
        plans: [
            {
                // name has to be lowercase
                "name": "basic",
                "priceId": env.STRIPE_PRODUCT_BASIC
            },
            {
                "name": "pro",
                priceId: env.STRIPE_PRODUCT_PRO
            },
            {
                // if this doesn't match, stripe will give a not found error
                "name": "enterprise",
                priceId: env.STRIPE_PRODUCT_ENTERPRISE
            },
        ]
    });
}

/**
 * We only want to protect trpc, we want to auth to not be blocked (so that people can actually auth)
 */
const authMiddleware = createMiddleware(async (c, next) => {
    const auth = getAuthInstance(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if(!session?.user) {
        return c.text("Unauthorized", 401);
    }
    const userId = session.user.id;
    c.set("userId", userId);
    await next();
})

App.all("/trpc/*", authMiddleware, (c) => {
    const userId = c.get("userId");
    return fetchRequestHandler({
        endpoint: "/trpc",
        req: c.req.raw,
        router: appRouter,
        createContext: () => {
            return createContext({ req: c.req.raw, env: c.env, workerCtx: c.executionCtx, userId })
        }
    });
});

App.get("/click-socket", authMiddleware, async (c) => {
    // you could isolate per account (where one account can be many users)
    const userId = c.get("userId");
    const headers = new Headers(c.req.raw.headers);
    // We will manually set this until the authentication logic is implemented
    headers.set("account-id", userId);
    const proxiedRequest = new Request(c.req.raw.url, { headers });
    return c.env.BACKEND_SERVICE.fetch(proxiedRequest);
})

// https://better-auth.com/docs/integrations/hono
App.on(["POST", "GET"], "/api/auth/*", (c) => {
    const auth = getAuthInstance(c.env)

    return auth.handler(c.req.raw);
})