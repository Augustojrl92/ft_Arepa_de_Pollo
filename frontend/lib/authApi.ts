const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const AUTH_BASE_URL = `${API_URL}/api/auth`

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