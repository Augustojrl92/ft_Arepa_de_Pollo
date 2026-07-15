const CACHE_VERSION = "aedlph-pwa-v1";
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const OFFLINE_PAGE_URL = "/offline";
const PRECACHE_URLS = [
	"/status",
	OFFLINE_PAGE_URL,
	"/icon-192.png",
	"/icon-512.png",
	"/42_logo.svg",
];

function isSuccessfulResponse(response) {
	return response && (response.ok || response.type === "opaque");
}

async function cachePage(request, response) {
	if (!isSuccessfulResponse(response)) {
		return response;
	}

	const cache = await caches.open(PAGE_CACHE);
	await cache.put(request, response.clone());
	return response;
}

async function cacheAsset(request, response) {
	if (!isSuccessfulResponse(response)) {
		return response;
	}

	const cache = await caches.open(ASSET_CACHE);
	await cache.put(request, response.clone());
	return response;
}

async function handleNavigation(request) {
	try {
		const networkResponse = await fetch(request);
		return await cachePage(request, networkResponse);
	} catch (_error) {
		const cachedPage = await caches.match(request);
		if (cachedPage) {
			return cachedPage;
		}

		const offlinePage = await caches.match(OFFLINE_PAGE_URL);
		if (offlinePage) {
			return offlinePage;
		}

		return Response.error();
	}
}

async function handleStatusRequest(request) {
	const cache = await caches.open(DATA_CACHE);

	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			await cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (_error) {
		const cachedResponse = await cache.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}

		return new Response(
			JSON.stringify({
				service: "pollo-backend",
				status: "error",
				database: "error",
				last_sync: null,
				timestamp: new Date().toISOString(),
				error: "Status is unavailable offline and no cached response exists yet.",
			}),
			{
				status: 503,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-store",
				},
			},
		);
	}
}

async function handleStaticAsset(request) {
	const cachedResponse = await caches.match(request);
	if (cachedResponse) {
		return cachedResponse;
	}

	const networkResponse = await fetch(request);
	return cacheAsset(request, networkResponse);
}

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(PAGE_CACHE)
			.then((cache) => cache.addAll(PRECACHE_URLS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => !key.startsWith(CACHE_VERSION))
						.map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") {
		return;
	}

	const url = new URL(request.url);

	if (request.mode === "navigate") {
		event.respondWith(handleNavigation(request));
		return;
	}

	if (url.pathname === "/api/status/") {
		event.respondWith(handleStatusRequest(request));
		return;
	}

	if (
		url.origin === self.location.origin &&
		(url.pathname.startsWith("/_next/static/") ||
			url.pathname.startsWith("/_next/image") ||
			url.pathname === "/favicon.ico" ||
			url.pathname === "/42_logo.svg" ||
			url.pathname === "/icon-192.png" ||
			url.pathname === "/icon-512.png")
	) {
		event.respondWith(handleStaticAsset(request));
	}
});
