import { betterAuth } from "better-auth";
import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {getDb} from "@/db/database";

let auth: ReturnType<typeof betterAuth>;

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
            provider: "sqlite"
        }),
        google
    );

    return auth;
}