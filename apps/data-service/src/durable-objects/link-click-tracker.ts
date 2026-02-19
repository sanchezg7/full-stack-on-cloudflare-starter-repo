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

	// async fetch(_: Request) {
	// 	const query = `
	// 		SELECT *
	// 		FROM geo_link_clicks
	// 		limit 100
	// 	`;
	//
	// 	const cursor = this.sql.exec(query);
	// 	const results = cursor.toArray();
	//
	// 	return new Response(
	// 		JSON.stringify({
	// 			clicks: results,
	// 		}),
	// 		{
	// 			headers: {
	// 				'Content-Type': 'application/json',
	// 			},
	// 		},
	// 	);
	// }
	async fetch(_: Request) {
		const webSocketPair = new WebSocketPair();
		// 0 index is always client
		const [client, server] = Object.values(webSocketPair);
		// the websocket is now accepted by DO, binding this instance of the server
		this.ctx.acceptWebSocket(server)
		// establish 2-way connection with client and server
		return new Response(null, {
			// websocket status to keep connection open (client to NOT close connection)
			status: 101,
			webSocket: client
		})
	}

	// /**
	//  * You can pass in the message that was received
	//  * @param ws
	//  * @param message
	//  */
	// async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer){
	// 	const connections = this.ctx.getWebSockets();
	// 	// broadcast to all of the connected clients
	// 	// this would be good for interactive apps
	// 	for(const con of connections) {
	// 		// don't send back to the same person that sent the message
	// 		// if con === ws
	// 		await con.send(message);
	// 	}
	// }
}
