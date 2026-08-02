"use client"

import { useEffect, useRef, useState } from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { AuthShell } from "@/components/AuthForm"
import { useAuthStore } from "@/hooks"
import { postVerifyEmail } from "@/lib/authApi"

type VerifyState = "verifying" | "success" | "error"

export default function VerifyEmail() {
	const [state, setState] = useState<VerifyState>("verifying")
	const [error, setError] = useState<string | null>(null)
	const hasRunRef = useRef(false)
	const router = useRouter()
	const initializeAuth = useAuthStore((s) => s.initializeAuth)

	useEffect(() => {
		// Read the query string directly rather than through useSearchParams so
		// the page does not need its own Suspense boundary at build time.
		if (hasRunRef.current) {
			return
		}

		hasRunRef.current = true

		const params = new URLSearchParams(window.location.search)
		const uid = params.get("uid")
		const token = params.get("token")

		if (!uid || !token) {
			setError("El enlace de confirmación está incompleto.")
			setState("error")
			return
		}

		void (async () => {
			try {
				await postVerifyEmail(uid, token)
				// Confirming signs the user in, so hydrate the store before leaving
				// or AuthLayout bounces them back to /login.
				await initializeAuth()
				setState("success")
				router.replace("/?auth=1")
			} catch (verifyError) {
				setError(
					verifyError instanceof Error ? verifyError.message : "No se ha podido confirmar el email",
				)
				setState("error")
			}
		})()
	}, [initializeAuth, router])

	if (state === "error") {
		return (
			<AuthShell title="Enlace no válido" subtitle="No hemos podido confirmar tu email.">
				<p className="text-sm text-red-500 text-center">{error}</p>
				<p className="text-sm text-text-secondary text-center">
					El enlace caduca a las 24 horas y solo puede usarse una vez. Si ya lo habías usado,
					inicia sesión con normalidad.
				</p>
				<Link href="/login" className="text-sm text-accent hover:underline text-center">
					Ir a iniciar sesión
				</Link>
			</AuthShell>
		)
	}

	return (
		<AuthShell
			title={state === "success" ? "Email confirmado" : "Confirmando tu email"}
			subtitle={state === "success" ? "Entrando..." : "Un momento."}
		>
			<p className="text-sm text-text-secondary text-center animate-pulse">
				{state === "success" ? "Redirigiendo..." : "Comprobando el enlace..."}
			</p>
		</AuthShell>
	)
}
