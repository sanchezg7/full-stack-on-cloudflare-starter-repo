import { Hono } from 'hono';
import { cloudflareInfoSchema } from "@repo/data-ops/zod-schema/links";
import {captureLinkClickInBackground, getDestinationForCountry, getRoutingDestinations} from "@/helpers/route-ops";
import { LinkClickMessageType } from "@repo/data-ops/zod-schema/queue";

export const App = new Hono<{Bindings: Env}>();

// This was the original version of this which was a hello world of the DO
// App.get("/do/:name", async (c) => {
// 	const name = c.req.param("name");
// 	const doId = c.env.EVALUATION_SCHEDULER.idFromName(name);
//
//
// 	const stub = c.env.EVALUATION_SCHEDULER.get(doId);
// 	// we now have an instance of the DO
// 	await stub.increment();
//
// 	const count = await stub.getCount();
//
// 	return c.json({
// 		count
// 	});
// })


App.get('/click-socket', async (c) => {
	const upgradeHeader = c.req.header('Upgrade');
	if (!upgradeHeader || upgradeHeader !== 'websocket') {
		return c.text('Expected Upgrade: websocket', 426);
	}

	// headers because then you can extend custom auth as well, here (instead of passing via param)
	const accountId = '12345';// c.req.header('accound-id')
	if (!accountId) return  c.text('No Headers', 404);
	const doId = c.env.LINK_CLICK_TRACKER_OBJECT.idFromName(accountId);
	const stub = c.env.LINK_CLICK_TRACKER_OBJECT.get(doId);
	return await stub.fetch(c.req.raw)
})
/**
 * We redirect the user AND kick off a fire and forget event on the queue so that this redirect is fast as possible
 * We ensure the change is still tracked but we decouple the speed to process that from the actual redirect.
 * This is the magic of queues
 */
App.get('/:id', async (c) => {
	const linkId = c.req.param('id');
	const linkInfo = await getRoutingDestinations(c.env, linkId)
	if(!linkInfo){
		return c.text('Destination not found', 404);
	}
	const cfHeader = cloudflareInfoSchema.safeParse(c.req.raw.cf);
	if(cfHeader.success === false){
		return c.text('Invalid CF header', 400);
	}

	const headers = cfHeader.data;
	const destination = getDestinationForCountry(linkInfo, headers.country);

	const queueMessage: LinkClickMessageType = {
		"type": "LINK_CLICK",
		"data": {
			id: linkId,
			country: headers.country,
			destination: destination,
			// I just this to make the type happy, not sure what it's for or if it's the right field.
			accountId: linkInfo.accountId,
			latitude: headers.latitude,
			longitude: headers.longitude,
			timestamp: new Date().toISOString(),
		}
	}
	/**
	 * This will take a few ms to send and get an ack from the queue with `await`
	await c.env.QUEUE.send(queueMessage); // we could do //sendBatch() so that we can send many at once, if needed.
	 we use waitUntil to ensure the serverless platform will do this without holding up the execution of the endpoint, we want to prioritize responsiveness
	 this will run in the background; however, there are some edge cases where this doesn't work. If you need to ensure that we don't lose it, then DON'T USE THIS.
	 it's great for less critical tasks like analytics
	 */
	c.executionCtx.waitUntil(
		captureLinkClickInBackground(c.env, queueMessage)
	)

	return c.redirect(destination);
})

// App.get('/link-click/:accountId', async (c) => {
// 	const accountId = c.req.param('accountId')
// 	const doId = c.env.LINK_CLICK_TRACKER_OBJECT.idFromName(accountId);
// 	const stub = c.env.LINK_CLICK_TRACKER_OBJECT.get(doId);
// 	// it's a fetch because it's actually a special type of compute. we send the raw request
// 	return await stub.fetch(c.req.raw)
// })


// -----------
// we are starting over with a more simple solution
// /**
//  * this is a dynamic id
//  * c will give the contenxt for hono. It will give access to the env, request, response
//  */
// App.get("/:id", async (c) => {
// 	/**
// 	 * We need to use the headers on the req
// 	 * Hono will add some helper methods at this point
// 	 * It can provide the c.req.raw from the cloudflare request
// 	 */
//
// 	const regularHeaders = c.req.raw.headers;
// 	console.log(JSON.stringify(c.req.raw.headers))
//
// 	/**
// 	 * This has a lot of useful info that CF will provide. Check out cf.mock.jsonc for an actual example
// 	 */
// 	const cfHeaders = c.req.raw.cf;
// 	console.log(JSON.stringify(cfHeaders))
//
// 	const country = cfHeaders?.country;
// 	const lat = cfHeaders?.latitude;
// 	const lng = cfHeaders?.longitude;
//
// 	return c.json({
// 		country,
// 		lat,
// 		lng
// 	})
// });
//

