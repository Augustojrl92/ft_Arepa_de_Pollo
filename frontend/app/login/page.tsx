"use client"

import { useEffect, useRef, useState } from "react"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { AuthFeedback, AuthField, AuthShell, AuthSubmit } from "@/components/AuthForm"
import { useAuthStore } from "@/hooks"
import { ApiHttpError, getLoginUrl, postEmailLogin } from "@/lib/authApi"
import { validateEmail, validatePassword } from "@/lib/passwordRules"

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
	oauth_failed: "Error de autenticación con 42. Por favor, inténtalo de nuevo.",
	not_in_campus_db: "Tu cuenta de 42 no está registrada en nuestra base de datos",
	not_in_madrid_campus: "Solo puedes acceder con una cuenta de 42 Madrid",
	account_already_exists: "Ya tienes una cuenta. Inicia sesión con tu email y contraseña.",
}

export default function Login() {
	const [isRedirecting, setIsRedirecting] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [fieldErrors, setFieldErrors] = useState<{ email?: string | null; password?: string | null }>({})
	const [error, setError] = useState<string | null>(null)
	const hasProcessedQueryError = useRef(false)
	const pathname = usePathname()
	const router = useRouter()
	const initializeAuth = useAuthStore((s) => s.initializeAuth)

	const handleOAuthLogin = () => {
		setIsRedirecting(true)
		window.location.href = getLoginUrl()
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError(null)

		const emailError = validateEmail(email)
		const passwordError = validatePassword(password)

		if (emailError || passwordError) {
			setFieldErrors({ email: emailError, password: passwordError })
			return
		}

		setFieldErrors({})
		setIsSubmitting(true)

		try {
			await postEmailLogin(email.trim(), password)
			await initializeAuth()
			router.replace("/")
		} catch (submitError) {
			if (submitError instanceof ApiHttpError && submitError.status === 429) {
				setError("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.")
			} else {
				setError(submitError instanceof Error ? submitError.message : "No se ha podido iniciar sesión")
			}
			setIsSubmitting(false)
		}
	}

	useEffect(() => {
		if (hasProcessedQueryError.current) {
			return
		}

		hasProcessedQueryError.current = true
		const errorParam = new URLSearchParams(window.location.search).get('error')

		if (errorParam) {
			// The callback reports failures the frontend does not have a friendly
			// wording for ("Invalid OAuth state", "Failed to obtain access token").
			// Falling through silently left the user back on a login page with no
			// explanation, so anything unrecognised is shown verbatim.
			setError(OAUTH_ERROR_MESSAGES[errorParam] ?? `No se ha podido completar el acceso con 42: ${errorParam}`)
		}

		if (window.location.search) {
			window.history.replaceState({}, document.title, `${pathname}${window.location.hash}`)
		}
	}, [pathname]);

	return (
		<AuthShell
			title="Iniciar sesión"
			subtitle="Accede con tu email o con tu cuenta de 42."
			footer={
				<div className="flex flex-col items-center gap-2">
					<p className="text-xs text-text-secondary text-center">
						Acceso limitado a estudiantes de <a href="https://www.42madrid.com/" target="_blank" className="text-accent hover:underline">42 Madrid</a>
					</p>
					<nav className="flex items-center gap-1 p-1 text-xs text-accent">
						<Link
							href="/privacy"
							className="px-2 py-1.5 sm:px-3 transition-all duration-200 hover:underline"
						>
							Política de Privacidad
						</Link>
						<div className="h-3 w-px bg-border/60 shrink-0" aria-hidden="true" />
						<Link
							href="/terms"
							className="px-2 py-1.5 sm:px-3 transition-all duration-200 hover:underline"
						>
							Términos de Servicio
						</Link>
					</nav>
				</div>
			}
		>
			<form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
				<AuthField
					id="login-email"
					label="Email"
					type="email"
					autoComplete="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					error={fieldErrors.email}
				/>
				<AuthField
					id="login-password"
					label="Contraseña"
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					error={fieldErrors.password}
				/>

				<AuthSubmit isLoading={isSubmitting}>Iniciar sesión</AuthSubmit>

				<Link href="/reset-password" className="text-xs text-text-secondary hover:text-accent text-center">
					¿Has olvidado tu contraseña?
				</Link>
			</form>

			<div className="flex items-center gap-3">
				<span className="h-px flex-1 bg-border" />
				<span className="text-xs text-text-secondary">o</span>
				<span className="h-px flex-1 bg-border" />
			</div>

			<button
				onClick={handleOAuthLogin}
				disabled={isRedirecting}
				className="cursor-pointer flex items-center justify-center gap-3 w-full py-3 px-6 rounded-lg bg-accent/10 border border-accent/30 text-accent font-semibold hover:bg-accent/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{isRedirecting ? (
					<span className="animate-pulse">Redirigiendo...</span>
				) : (
					<>
						Acceder con
						<img src="/42_logo.svg" alt="Logo 42" className="w-5 h-5" />
					</>
				)}
			</button>

			<AuthFeedback error={error} />

			<p className="text-sm text-text-secondary text-center">
				¿Primera vez aquí?{" "}
				<Link href="/register" className="text-accent hover:underline">
					Crea una cuenta
				</Link>
			</p>
		</AuthShell>
	)
}
