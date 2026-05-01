const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const STATUS_ENDPOINT = `${API_URL}/api/status/`

export type SystemStatus = {
	service: string
	status: "ok" | "error"
	database: "ok" | "error"
	last_sync: string | null
	timestamp: string
	error?: string
}

export const fetchSystemStatus = async (): Promise<SystemStatus> => {
	const response = await fetch(STATUS_ENDPOINT, {
		method: "GET",
		cache: "no-store",
	})

	const payload = await response.json().catch(() => null) as SystemStatus | null

	if (!response.ok || payload === null) {
		throw new Error(payload?.error ?? `No se pudo consultar ${STATUS_ENDPOINT}`)
	}

	return payload
}
