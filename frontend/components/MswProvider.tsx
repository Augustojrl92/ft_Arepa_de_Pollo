"use client"

import { useEffect } from "react"

declare global {
	interface Window {
		__mswStartPromise?: Promise<void>
	}
}

type MswProviderProps = {
	children: React.ReactNode
}

export default function MswProvider({ children }: MswProviderProps) {
	useEffect(() => {
		const isMockingEnabled = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_API_MOCKING !== "disabled"

		if (!isMockingEnabled) {
			return
		}

		const startWorker = async () => {
			if (!window.__mswStartPromise) {
				window.__mswStartPromise = (async () => {
					const { worker } = await import("@/mocks/browser")
					await worker.start({ onUnhandledRequest: "bypass" })
				})()
			}
		}

		void startWorker()
	}, [])

	return <>{children}</>
}
