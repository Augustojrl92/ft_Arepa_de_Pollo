/**
 * Client-side mirror of the backend password policy.
 *
 * These checks exist for immediate feedback only — the authority is
 * AUTH_PASSWORD_VALIDATORS in the Django settings, which runs on every request
 * regardless of whether it came from this form.
 */

export const PASSWORD_MIN_LENGTH = 10

export const validateEmail = (email: string): string | null => {
	const value = email.trim()

	if (!value) {
		return "Introduce tu email."
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
		return "Introduce un email válido."
	}

	return null
}

export const validatePassword = (password: string): string | null => {
	if (!password) {
		return "Introduce una contraseña."
	}

	if (password.length < PASSWORD_MIN_LENGTH) {
		return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
	}

	if (/^\d+$/.test(password)) {
		return "La contraseña no puede ser solo números."
	}

	return null
}

export const validatePasswordConfirm = (password: string, confirm: string): string | null => {
	if (password !== confirm) {
		return "Las contraseñas no coinciden."
	}

	return null
}
