const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const STATUS_ENDPOINT = `${API_URL}/api/status/`

export type SystemStatus = {
	service: string
	status: "ok" | "error"
	backend: "ok" | "error"
	database: "ok" | "error"
	last_sync: string | null
	timestamp: string
	errors?: string[]
}

export const fetchSystemStatus = async (): Promise<SystemStatus> => {
	const response = await fetch(STATUS_ENDPOINT, {
		method: "GET",
		cache: "no-store",
	})

	const payload = await response.json().catch(() => null) as SystemStatus | null

	if (payload === null) {
		throw new Error(`No se pudo consultar ${STATUS_ENDPOINT}`)
	}
	if (!response.ok && payload.status !== "error") {
		throw new Error(payload.errors?.join(". ") ?? `No se pudo consultar ${STATUS_ENDPOINT}`)
	}

	return payload
}
