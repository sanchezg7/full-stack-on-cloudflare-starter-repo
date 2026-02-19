import { getLink } from "@repo/data-ops/queries/links";
import { linkSchema, LinkSchemaType } from "@repo/data-ops/zod-schema/links";
import { LinkClickMessageType } from '@repo/data-ops/zod-schema/queue';
import moment from 'moment';

async function getLinkInfoFromKv(env: Env, id: string) {
	const linkInfo = await env.CACHE.get(id)
	if (!linkInfo) {
		return null;
	}
	try {
		const parsedLinkInfo = JSON.parse(linkInfo);
		return linkSchema.parse(parsedLinkInfo);
	} catch (error) {
		return null;
	}
}

const TTL_TIME_ONE_DAY = 60 * 60 * 24 // 1 day

async function saveLinkInfoToKv(env: Env, linkId: string, linkInfo: LinkSchemaType) {
	try {
		await env.CACHE.put(linkId, JSON.stringify(linkInfo),
			{
				// automatic cleanup at a later date
				expirationTtl: TTL_TIME_ONE_DAY
			}
		);
	} catch (error) {
	}
}


export async function getRoutingDestinations(env: Env, linkId: string) {
	const linkInfo = await getLinkInfoFromKv(env, linkId);
	if (linkInfo) return linkInfo;
	const linkInfoFromDb = await getLink(linkId);
	if (!linkInfoFromDb) {
		return null;
	}
	await saveLinkInfoToKv(env, linkId, linkInfoFromDb);
	return linkInfoFromDb
}


export function getDestinationForCountry(linkInfo: LinkSchemaType, countryCode?: string) {
	if (!countryCode) {
		return linkInfo.destinations.default;
	}

	// Check if the country code exists in destinations
	if (linkInfo.destinations[countryCode]) {
		return linkInfo.destinations[countryCode];
	}

	// Fallback to default
	return linkInfo.destinations.default;
}

export async function captureLinkClickInBackground(env: Env, event: LinkClickMessageType) {
	await env.QUEUE.send(event)
	const doId = env.LINK_CLICK_TRACKER_OBJECT.idFromName(event.data.accountId);
	const stub = env.LINK_CLICK_TRACKER_OBJECT.get(doId);
	if (!event.data.latitude || !event.data.longitude || !event.data.country) {
		return;
	}
	await stub.addClick(
		event.data.latitude,
		event.data.longitude,
		event.data.country,
		moment().valueOf()
		// this was moment().valueOf() but I didn't want that
		// new Date().getDate()
	)
}
