import { createAuthClient } from "better-auth/react";
import { stripeClient } from "@better-auth/stripe/client";

/**
 * This will give different hooks that you can latch onto
 */
export const authClient = createAuthClient(
    {
        // this isn't needed because the origin for the backend and frontend is the same
        // baseURL
        plugins: [
            stripeClient({
                subscription: true
            })
        ]
    }
);
