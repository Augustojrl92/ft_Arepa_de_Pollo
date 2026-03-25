"use client"

import { useEffect } from "react"

declare global {
	interface Window {
		__mswStarted?: boolean
	}
}

type MswProviderProps = {
	children: React.ReactNode
}

export default function MswProvider({ children }: MswProviderProps) {
	useEffect(() => {
		if (process.env.NODE_ENV !== "development") {
			return
		}

		if (process.env.NEXT_PUBLIC_API_MOCKING === "disabled") {
			return
		}

		if (window.__mswStarted) {
			return
		}

		window.__mswStarted = true

		const startWorker = async () => {
			const { worker } = await import("@/mocks/browser")
			await worker.start({ onUnhandledRequest: "bypass" })
		}

		startWorker()
	}, [])

	return <>{children}</>
}
