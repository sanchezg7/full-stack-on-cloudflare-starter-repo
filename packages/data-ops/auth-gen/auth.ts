import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

/**
 * Better auth can generate schemas for drizzle on our behalf
 */

/**
 * https://better-auth.com/docs/basic-usage
 */
export const auth = betterAuth({
  database: new Database("./sqlite.db"),
});
