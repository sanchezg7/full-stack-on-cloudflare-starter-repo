import { createAuthClient } from "better-auth/react";

/**
 * This will give different hooks that you can latch onto
 */
export const authClient = createAuthClient(
    // {
        // this isn't needed because the origin for the backend and frontend is the same
        // baseURL
    // }
);
