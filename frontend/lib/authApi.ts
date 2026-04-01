const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const AUTH_BASE_URL = `${API_URL}/api/auth`

type ApiErrorPayload = {
	error?: string
	detail?: string
}

export class ApiHttpError extends Error {
	status: number

	constructor(message: string, status: number) {
		super(message)
		this.name = "ApiHttpError"
		this.status = status
	}
}

const getErrorMessage = async (response: Response, fallbackMessage: string) => {
	const payload = await response.json().catch(() => null) as ApiErrorPayload | null

	return payload?.error ?? payload?.detail ?? fallbackMessage
}

export const getLoginUrl = () => `${AUTH_BASE_URL}/42/login/`

let refreshInFlight: Promise<void> | null = null

const refreshAccessToken = async () => {
	if (refreshInFlight) {
		return refreshInFlight
	}

	refreshInFlight = (async () => {
	const response = await fetch(`${AUTH_BASE_URL}/token/refresh/`, {
		method: "POST",
		credentials: "include",
	})

	if (!response.ok) {
		throw new ApiHttpError(
			await getErrorMessage(response, "Failed to refresh auth token"),
			response.status,
		)
	}
	})()

	try {
		await refreshInFlight
	} finally {
		refreshInFlight = null
	}

	return true
}

export const authFetch = async (
	url: string,
	init: RequestInit,
	fallbackMessage: string,
) => {
	let response = await fetch(url, {
		...init,
		credentials: "include",
	})

	if (response.status === 401) {
		await refreshAccessToken()
		response = await fetch(url, {
			...init,
			credentials: "include",
		})
	}

	if (!response.ok) {
		throw new ApiHttpError(
			await getErrorMessage(response, fallbackMessage),
			response.status,
		)
	}

	return response
}

export const authFetchJson = async <T>(
	url: string,
	init: RequestInit,
	fallbackMessage: string,
) => {
	const response = await authFetch(url, init, fallbackMessage)
	return response.json() as Promise<T>
}

export const getProfile = async () => {
	const response = await authFetch(`${AUTH_BASE_URL}/profile/`, {
		method: "GET",
	}, "Failed to fetch user profile")

	return response.json()
}

export const postLogout = async () => {
	const response = await fetch(`${AUTH_BASE_URL}/logout/`, {
		method: "POST",
		credentials: "include",
	})

	if (!response.ok) {
		throw new ApiHttpError(
			await getErrorMessage(response, "Failed to logout"),
			response.status,
		)
	}

	return true
}
