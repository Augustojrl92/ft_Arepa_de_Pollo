"use client"

import { useState } from "react"

import Link from "next/link"

import { AuthFeedback, AuthField, AuthShell, AuthSubmit } from "@/components/AuthForm"
import { ApiHttpError, postRegister } from "@/lib/authApi"
import {
	PASSWORD_MIN_LENGTH,
	validateEmail,
	validatePassword,
	validatePasswordConfirm,
} from "@/lib/passwordRules"

type FieldErrors = {
	email?: string | null
	password?: string | null
	passwordConfirm?: string | null
}

export default function Register() {
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [passwordConfirm, setPasswordConfirm] = useState("")
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
	const [error, setError] = useState<string | null>(null)
	const [submitted, setSubmitted] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError(null)

		const errors: FieldErrors = {
			email: validateEmail(email),
			password: validatePassword(password),
			passwordConfirm: validatePasswordConfirm(password, passwordConfirm),
		}

		if (errors.email || errors.password || errors.passwordConfirm) {
			setFieldErrors(errors)
			return
		}

		setFieldErrors({})
		setIsSubmitting(true)

		try {
			await postRegister(email.trim(), password, passwordConfirm)
			setSubmitted(true)
		} catch (submitError) {
			if (submitError instanceof ApiHttpError && submitError.status === 429) {
				setError("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.")
			} else {
				setError(submitError instanceof Error ? submitError.message : "No se ha podido completar el registro")
			}
		} finally {
			setIsSubmitting(false)
		}
	}

	if (submitted) {
		return (
			<AuthShell title="Revisa tu email" subtitle="Ya casi está.">
				<p className="text-sm text-text-secondary text-center">
					Si esa dirección puede usarse, te hemos enviado un enlace de confirmación. Ábrelo
					para activar tu cuenta.
				</p>
				<Link href="/login" className="text-sm text-accent hover:underline text-center">
					Volver a iniciar sesión
				</Link>
			</AuthShell>
		)
	}

	return (
		<AuthShell
			title="Crear cuenta"
			subtitle="Regístrate con tu email y una contraseña."
			footer={
				<p className="text-xs text-text-secondary text-center">
					¿Ya tienes cuenta?{" "}
					<Link href="/login" className="text-accent hover:underline">
						Inicia sesión
					</Link>
				</p>
			}
		>
			{/* Set expectations up front: the account starts with no access. */}
			<p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary text-center">
				Tu cuenta empezará como <strong>invitado</strong>, sin acceso a los datos del campus.
				Para ver coaliciones, rankings y perfiles tendrás que vincular tu cuenta de 42 después.
			</p>

			<form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
				<AuthField
					id="register-email"
					label="Email"
					type="email"
					autoComplete="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					error={fieldErrors.email}
				/>
				<AuthField
					id="register-password"
					label="Contraseña"
					type="password"
					autoComplete="new-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					error={fieldErrors.password}
				/>
				<AuthField
					id="register-password-confirm"
					label="Repite la contraseña"
					type="password"
					autoComplete="new-password"
					value={passwordConfirm}
					onChange={(event) => setPasswordConfirm(event.target.value)}
					error={fieldErrors.passwordConfirm}
				/>

				<p className="text-xs text-text-secondary">
					Mínimo {PASSWORD_MIN_LENGTH} caracteres. Evita contraseñas comunes o solo numéricas.
				</p>

				<AuthSubmit isLoading={isSubmitting}>Crear cuenta</AuthSubmit>
			</form>

			<AuthFeedback error={error} />
		</AuthShell>
	)
}
