const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const AUTH_BASE_URL = `${API_URL}/api/auth`
const COALITIONS_BASE_URL = `${API_URL}/api/coalitions`

type ApiErrorPayload = {
	error?: string
	detail?: string
}

const getErrorMessage = async (response: Response, fallbackMessage: string) => {
	const payload = await response.json().catch(() => null) as ApiErrorPayload | null

	return payload?.error ?? payload?.detail ?? fallbackMessage
}

export const getLoginUrl = () => `${AUTH_BASE_URL}/42/login/`

export const getProfile = async () => {
	const response = await fetch(`${AUTH_BASE_URL}/profile/`, {
		method: "GET",
		credentials: "include",
	})

	if (!response.ok) {
		throw new Error(await getErrorMessage(response, "Failed to fetch user profile"))
	}

	return response.json()
}

export const getCoalitionLeaderboard = async () => {
	const response = await fetch(`${COALITIONS_BASE_URL}/leaderboard/`, {
		method: "GET",
		credentials: "include",
	})

	if (!response.ok) {
		throw new Error(await getErrorMessage(response, "Failed to fetch coalition leaderboard"))
	}

	const payload = await response.json()
	return {
		coalitions: (payload.coalitions ?? []).map((coalition: { name: string; total_points: number }) => ({
			name: coalition.name,
			totalPoints: coalition.total_points,
		})),
	}
}

export const postTokenRefresh = async () => {
	const response = await fetch(`${AUTH_BASE_URL}/token/refresh/`, {
		method: "POST",
		credentials: "include",
	})

	if (!response.ok) {
		throw new Error(await getErrorMessage(response, "Failed to refresh token"))
	}

	return true
}

export const postLogout = async () => {
	const response = await fetch(`${AUTH_BASE_URL}/logout/`, {
		method: "POST",
		credentials: "include",
	})

	if (!response.ok) {
		throw new Error(await getErrorMessage(response, "Failed to logout"))
	}

	return true
}
