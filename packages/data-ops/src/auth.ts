import { betterAuth } from "better-auth";
import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {getDb} from "@/db/database";
import {account, session, user, verification} from "@/drizzle-out/auth-schema";

let auth: ReturnType<typeof betterAuth>;

/**
 * Better auth can generate schemas for drizzle on our behalf
 * https://better-auth.com/docs/basic-usage
 */
export function createBetterAuth(
    database: NonNullable<Parameters<typeof betterAuth>[0]>["database"],
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
        }
    });
};

export function getAuth(google: { clientId: string; clientSecret: string }) {
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
        google
    );

    return auth;
}