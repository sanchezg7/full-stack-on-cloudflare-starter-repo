import { DurableObject } from "cloudflare:workers";

export class LinkClickTracker extends DurableObject {
	// the storage api
	sql: SqlStorage;
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;

		ctx.blockConcurrencyWhile(async () => {
			// make sure the schema is in sync before the DO does anything
			this.sql.exec(`
				CREATE TABLE IF NOT EXISTS geo_link_clicks (
					latitude REAL NOT NULL,
					longitude REAL NOT NULL,
					country TEXT NOT NULL,
					time INTEGER NOT NULL
				)
			`);
		});
	}

	async addClick(latitude: number, longitude: number, country: string, time: number) {
		// this has bindings
		// there are ways use drizzle as well: https://orm.drizzle.team/docs/connect-cloudflare-do
		this.sql.exec(
			`
			INSERT INTO geo_link_clicks (latitude, longitude, country, time)
			VALUES (?, ?, ?, ?)
			`,
			latitude,
			longitude,
			country,
			time,
		);
	}

	async fetch(_: Request) {
		const query = `
			SELECT *
			FROM geo_link_clicks
			limit 100
		`;

		const cursor = this.sql.exec(query);
		const results = cursor.toArray();

		return new Response(
			JSON.stringify({
				clicks: results,
			}),
			{
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);
	}
}
