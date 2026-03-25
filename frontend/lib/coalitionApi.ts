import { Coalition } from "@/types"

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const COALITION_BASE_URL = `${API_URL}/api/coalition/`

type ApiErrorPayload = {
	error?: string
	detail?: string
}

const getErrorMessage = async (response: Response, fallbackMessage: string) => {
	const payload = await response.json().catch(() => null) as ApiErrorPayload | null

	return payload?.error ?? payload?.detail ?? fallbackMessage
}

export const getCoalitions = async (): Promise<Coalition[]> => {
	const response = await fetch(COALITION_BASE_URL)

	if (!response.ok) {
		throw new Error(await getErrorMessage(response, "Failed to fetch coalitions"))
	}

	return response.json() as Promise<Coalition[]>
}
