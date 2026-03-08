import {App} from "./hono/app";
import {initDatabase} from "@repo/data-ops/database";//"@repo/data-ops/database";

export default {
    fetch(request, env, ctx) {
        initDatabase(env.DB)
        return App.fetch(request, env, ctx);
        // This is commented out because we've moved it to the App module
        // const url = new URL(request.url);
        //
        //
        // if (url.pathname.startsWith("/trpc")) {
        //     return fetchRequestHandler({
        //         endpoint: "/trpc",
        //         req: request,
        //         router: appRouter,
        //         createContext: () =>
        //             createContext({req: request, env: env, workerCtx: ctx}),
        //     });
        // }
        // // We want to proxy /click-socket to the data-service
        //
        // return env.ASSETS.fetch(request);
    },
} satisfies ExportedHandler<ServiceBindings>;
