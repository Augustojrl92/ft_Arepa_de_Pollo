const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const AUTH_BASE_URL = `${API_URL}/api/auth`

type ApiErrorPayload = {
	error?: string
	detail?: string
	[field: string]: unknown
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

	if (payload?.error || payload?.detail) {
		return payload.error ?? payload.detail as string
	}

	// DRF serializer errors arrive keyed by field, e.g. {password: ["too short"]}.
	// Surface the first one so validation feedback is not swallowed.
	if (payload && typeof payload === "object") {
		for (const value of Object.values(payload)) {
			if (Array.isArray(value) && typeof value[0] === "string") {
				return value[0]
			}
			if (typeof value === "string") {
				return value
			}
		}
	}

	return fallbackMessage
}

export const getLoginUrl = () => `${AUTH_BASE_URL}/42/login/`

// Attaching a 42 identity to the signed-in account. This is what turns a guest
// into a campus user; it is not a way to sign in.
export const getLink42Url = () => `${AUTH_BASE_URL}/42/link/`

const postJson = async <T>(path: string, body: unknown, fallbackMessage: string) => {
	const response = await fetch(`${AUTH_BASE_URL}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(body),
	})

	if (!response.ok) {
		throw new ApiHttpError(await getErrorMessage(response, fallbackMessage), response.status)
	}

	return response.json() as Promise<T>
}

type DetailPayload = { detail: string }

export const postRegister = (email: string, password: string, passwordConfirm: string) =>
	postJson<DetailPayload>(
		"/register/",
		{ email, password, password_confirm: passwordConfirm },
		"No se ha podido completar el registro",
	)

export const postVerifyEmail = (uid: string, token: string) =>
	postJson<DetailPayload>("/verify-email/", { uid, token }, "No se ha podido confirmar el email")

export const deleteAccount = async () => {
	const response = await fetch(`${AUTH_BASE_URL}/account/`, {
		method: "DELETE",
		credentials: "include",
	})

	if (!response.ok) {
		throw new ApiHttpError(await getErrorMessage(response, "No se ha podido eliminar la cuenta"), response.status)
	}

	return true
}

export const postEmailLogin = (email: string, password: string) =>
	postJson<DetailPayload>("/login/", { email, password }, "No se ha podido iniciar sesión")

export const postPasswordResetRequest = (email: string) =>
	postJson<DetailPayload>("/password/reset/", { email }, "No se ha podido enviar el email de recuperación")

export const postPasswordResetConfirm = (
	uid: string,
	token: string,
	newPassword: string,
	newPasswordConfirm: string,
) =>
	postJson<DetailPayload>(
		"/password/reset/confirm/",
		{ uid, token, new_password: newPassword, new_password_confirm: newPasswordConfirm },
		"No se ha podido cambiar la contraseña",
	)

export const postSetPassword = (
	newPassword: string,
	newPasswordConfirm: string,
	currentPassword?: string,
) =>
	postJson<DetailPayload>(
		"/password/set/",
		{
			new_password: newPassword,
			new_password_confirm: newPasswordConfirm,
			...(currentPassword ? { current_password: currentPassword } : {}),
		},
		"No se ha podido guardar la contraseña",
	)

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
		try {
			await refreshAccessToken()
			response = await fetch(url, {
				...init,
				credentials: "include",
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : fallbackMessage
			throw new ApiHttpError(message, 401)
		}
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
