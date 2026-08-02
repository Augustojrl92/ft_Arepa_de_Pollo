"use client"

import { useState } from "react"

import { postSetPassword } from "@/lib/authApi"
import {
	PASSWORD_MIN_LENGTH,
	validatePassword,
	validatePasswordConfirm,
} from "@/lib/passwordRules"

/**
 * Lets the signed-in account add or change its password.
 *
 * Accounts created through 42 start without one, so this is how they gain a
 * second, independent way to sign in. `current_password` is only required by
 * the backend once a password already exists, which is why it is optional here.
 */
export function PasswordSettings() {
	const [currentPassword, setCurrentPassword] = useState("")
	const [password, setPassword] = useState("")
	const [passwordConfirm, setPasswordConfirm] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [isSaving, setIsSaving] = useState(false)

	const inputClasses =
		"w-full rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm outline-none focus:border-accent"

	const handleSave = async () => {
		setError(null)
		setSuccess(null)

		const passwordError = validatePassword(password) ?? validatePasswordConfirm(password, passwordConfirm)
		if (passwordError) {
			setError(passwordError)
			return
		}

		setIsSaving(true)

		try {
			await postSetPassword(password, passwordConfirm, currentPassword || undefined)
			setSuccess("Contraseña actualizada.")
			setCurrentPassword("")
			setPassword("")
			setPasswordConfirm("")
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "No se ha podido guardar la contraseña")
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<div>
			<span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
				Contraseña
			</span>
			<div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/40 p-3">
				<p className="text-xs text-text-secondary">
					Añade una contraseña para poder entrar sin pasar por 42. Mínimo {PASSWORD_MIN_LENGTH} caracteres.
				</p>

				<input
					type="password"
					autoComplete="current-password"
					placeholder="Contraseña actual (si ya tienes una)"
					value={currentPassword}
					onChange={(event) => setCurrentPassword(event.target.value)}
					className={inputClasses}
					aria-label="Contraseña actual"
				/>
				<input
					type="password"
					autoComplete="new-password"
					placeholder="Nueva contraseña"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					className={inputClasses}
					aria-label="Nueva contraseña"
				/>
				<input
					type="password"
					autoComplete="new-password"
					placeholder="Repite la nueva contraseña"
					value={passwordConfirm}
					onChange={(event) => setPasswordConfirm(event.target.value)}
					className={inputClasses}
					aria-label="Repite la nueva contraseña"
				/>

				{error && <p className="text-xs text-red-500">{error}</p>}
				{success && <p className="text-xs text-emerald-500">{success}</p>}

				<button
					type="button"
					onClick={() => void handleSave()}
					disabled={isSaving}
					className="cursor-pointer self-start rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-text-secondary hover:text-text disabled:opacity-60"
				>
					{isSaving ? "Guardando..." : "Guardar contraseña"}
				</button>
			</div>
		</div>
	)
}
