"use client";

import { useEffect } from "react";

const shouldEnablePwa =
	process.env.NODE_ENV === "production" ||
	process.env.NEXT_PUBLIC_ENABLE_PWA === "true";

export default function ServiceWorkerRegistration() {
	useEffect(() => {
		if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
			return;
		}

		if (!shouldEnablePwa) {
			void navigator.serviceWorker.getRegistrations().then((registrations) => {
				for (const registration of registrations) {
					void registration.unregister();
				}
			});
			return;
		}

		void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
			console.warn("Service worker registration failed", error);
		});
	}, []);

	return null;
}
