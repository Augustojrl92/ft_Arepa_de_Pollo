"use client"

import { useEffect, useState } from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { AuthFeedback, AuthField, AuthShell, AuthSubmit } from "@/components/AuthForm"
import { useAuthStore } from "@/hooks"
import { postPasswordResetConfirm } from "@/lib/authApi"
import {
	PASSWORD_MIN_LENGTH,
	validatePassword,
	validatePasswordConfirm,
} from "@/lib/passwordRules"

export default function ResetPasswordConfirm() {
	const [credentials, setCredentials] = useState<{ uid: string; token: string } | null>(null)
	const [password, setPassword] = useState("")
	const [passwordConfirm, setPasswordConfirm] = useState("")
	const [fieldErrors, setFieldErrors] = useState<{ password?: string | null; confirm?: string | null }>({})
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const router = useRouter()
	const initializeAuth = useAuthStore((s) => s.initializeAuth)

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const uid = params.get("uid")
		const token = params.get("token")

		if (uid && token) {
			setCredentials({ uid, token })
		}
	}, [])

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError(null)

		if (!credentials) {
			return
		}

		const passwordError = validatePassword(password)
		const confirmError = validatePasswordConfirm(password, passwordConfirm)

		if (passwordError || confirmError) {
			setFieldErrors({ password: passwordError, confirm: confirmError })
			return
		}

		setFieldErrors({})
		setIsSubmitting(true)

		try {
			await postPasswordResetConfirm(credentials.uid, credentials.token, password, passwordConfirm)
			// The endpoint signs the user in on success.
			await initializeAuth()
			router.replace("/?auth=1")
		} catch (submitError) {
			setError(
				submitError instanceof Error ? submitError.message : "No se ha podido cambiar la contraseña",
			)
			setIsSubmitting(false)
		}
	}

	if (credentials === null) {
		return (
			<AuthShell title="Enlace no válido" subtitle="Falta información en el enlace.">
				<p className="text-sm text-text-secondary text-center">
					Vuelve a solicitar el cambio de contraseña para recibir un enlace nuevo.
				</p>
				<Link href="/reset-password" className="text-sm text-accent hover:underline text-center">
					Solicitar otro enlace
				</Link>
			</AuthShell>
		)
	}

	return (
		<AuthShell
			title="Nueva contraseña"
			subtitle="Elige una contraseña para tu cuenta."
			footer={
				<Link href="/login" className="text-xs text-text-secondary hover:text-accent">
					Volver a iniciar sesión
				</Link>
			}
		>
			<form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
				<AuthField
					id="reset-new-password"
					label="Nueva contraseña"
					type="password"
					autoComplete="new-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					error={fieldErrors.password}
				/>
				<AuthField
					id="reset-new-password-confirm"
					label="Repite la contraseña"
					type="password"
					autoComplete="new-password"
					value={passwordConfirm}
					onChange={(event) => setPasswordConfirm(event.target.value)}
					error={fieldErrors.confirm}
				/>

				<p className="text-xs text-text-secondary">
					Mínimo {PASSWORD_MIN_LENGTH} caracteres. Evita contraseñas comunes o solo numéricas.
				</p>

				<AuthSubmit isLoading={isSubmitting}>Guardar contraseña</AuthSubmit>
			</form>

			<AuthFeedback error={error} />
		</AuthShell>
	)
}
