"use client"

import { useState } from "react"

import Link from "next/link"

import { AuthFeedback, AuthField, AuthShell, AuthSubmit } from "@/components/AuthForm"
import { ApiHttpError, postPasswordResetRequest } from "@/lib/authApi"
import { validateEmail } from "@/lib/passwordRules"

export default function ResetPasswordRequest() {
	const [email, setEmail] = useState("")
	const [emailError, setEmailError] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [submitted, setSubmitted] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError(null)

		const validationError = validateEmail(email)
		if (validationError) {
			setEmailError(validationError)
			return
		}

		setEmailError(null)
		setIsSubmitting(true)

		try {
			await postPasswordResetRequest(email.trim())
			setSubmitted(true)
		} catch (submitError) {
			if (submitError instanceof ApiHttpError && submitError.status === 429) {
				setError("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.")
			} else {
				setError(
					submitError instanceof Error
						? submitError.message
						: "No se ha podido enviar el email de recuperación",
				)
			}
		} finally {
			setIsSubmitting(false)
		}
	}

	if (submitted) {
		return (
			<AuthShell title="Revisa tu email" subtitle="Te hemos enviado las instrucciones.">
				<p className="text-sm text-text-secondary text-center">
					Si existe una cuenta con ese email, recibirás un enlace para elegir una contraseña
					nueva. Caduca a las 24 horas.
				</p>
				<Link href="/login" className="text-sm text-accent hover:underline text-center">
					Volver a iniciar sesión
				</Link>
			</AuthShell>
		)
	}

	return (
		<AuthShell
			title="Recuperar contraseña"
			subtitle="Te enviaremos un enlace para elegir una nueva."
			footer={
				<Link href="/login" className="text-xs text-text-secondary hover:text-accent">
					Volver a iniciar sesión
				</Link>
			}
		>
			<form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
				<AuthField
					id="reset-email"
					label="Email"
					type="email"
					autoComplete="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					error={emailError}
				/>

				<AuthSubmit isLoading={isSubmitting}>Enviar enlace</AuthSubmit>
			</form>

			<AuthFeedback error={error} />
		</AuthShell>
	)
}
