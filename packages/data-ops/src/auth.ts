import { betterAuth } from "better-auth";
import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {getDb} from "@/db/database";
import {account, session, user, verification} from "@/drizzle-out/auth-schema";
// use stripe plugin
import { stripe } from "@better-auth/stripe";
// use stripe SDK
import Stripe from "stripe";

let auth: ReturnType<typeof betterAuth>;

/**
 * We make this type in order to make it extensible
 */
type StripeConfig = {
    stripeWebhookSecret: string;
    plans: any[];
}

const stripeClient = new Stripe("", {
    // this was auto completed
    apiVersion: "2025-03-31.basil",
})

/**
 * Better auth can generate schemas for drizzle on our behalf
 * https://better-auth.com/docs/basic-usage
 */
export function createBetterAuth(
    database: NonNullable<Parameters<typeof betterAuth>[0]>["database"],
    stripeConfig?: StripeConfig,
    google?: { clientId: string; clientSecret: string },
): ReturnType<typeof betterAuth> {
    return betterAuth({
        database,
        emailAndPassword: {
            enabled: false
        },
        socialProviders: {
            google: {
                clientId: google?.clientId ?? "",
                clientSecret: google?.clientSecret ?? "",
            }
        },
        plugins: [
            stripe({
                stripeClient,
                stripeWebhookSecret: stripeConfig?.stripeWebhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET!,
                // put the customer in stripe when the user signs up for the first time in our app. This will power the new schema for the users table
                createCustomerOnSignUp: true,
                subscription: {
                    enabled: true,
                    plans: stripeConfig?.plans ?? []
                }
            })
        ]
    });
};

export function getAuth(
    google: { clientId: string; clientSecret: string },
    stripe: StripeConfig,

): ReturnType<typeof betterAuth>  {
    if (auth) {
        return auth;
    }

    auth = createBetterAuth(
        drizzleAdapter(getDb(), {
            provider: "sqlite",
            // this gives more context about what tables we have and what the deps are
            schema: {
                user,
                session,
                account,
                verification,
            }
        }),
        stripe,
        google
    );

    return auth;
}