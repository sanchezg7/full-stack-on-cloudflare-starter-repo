import { DurableObject } from "cloudflare:workers";
import {deleteClicksBefore, getRecentClicks} from "@/helpers/durable-queries";

export class LinkClickTracker extends DurableObject {
	// the storage api
	sql: SqlStorage;

	leastRecentOffsetTime: number = 0;
	mostRecentOffsetTime: number = 0;
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;

		ctx.blockConcurrencyWhile(async () => {
			const [leastRecentOffsetTime, mostRecentOffsetTime] = await Promise.all([
				ctx.storage.get<number>('leastRecentOffsetTime'),
				ctx.storage.get<number>('mostRecentOffsetTime'),
			]);

			this.leastRecentOffsetTime = leastRecentOffsetTime || this.leastRecentOffsetTime;
			this.mostRecentOffsetTime = mostRecentOffsetTime || this.mostRecentOffsetTime;

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
		const alarm = await this.ctx.storage.getAlarm()
		if(!alarm) {
			// alarm isn't delayed more than 2 secs
			await this.ctx.storage.setAlarm(Date.now() + 2000);
		}
	}

	async alarm() {
		console.log('link-click-tracker-alarm');

		const clickData = getRecentClicks(this.sql, this.mostRecentOffsetTime);
		// we want to iterate through active connections and send data
		const sockets = this.ctx.getWebSockets();
		for (const socket of sockets) {
			socket.send(JSON.stringify(clickData.clicks));
		}

		await this.flushOffsetTimes(clickData.mostRecentTime, clickData.oldestTime);
		await deleteClicksBefore(this.sql, clickData.oldestTime)
	}

	/**
	 * Move them from memory into storage so we have the window
	 */
	async flushOffsetTimes(mostRecentOffsetTime: number, leastRecentOffsetTime: number) {
		this.mostRecentOffsetTime = mostRecentOffsetTime;
		this.leastRecentOffsetTime = leastRecentOffsetTime;
		await this.ctx.storage.put('mostRecentOffsetTime', this.mostRecentOffsetTime);
		await this.ctx.storage.put('leastRecentOffsetTime', this.leastRecentOffsetTime);
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
