"use client"

import { useEffect, useRef, useState } from "react"

import { AuthShell } from "@/components/AuthForm"
import { useAuthStore } from "@/hooks"
import { deleteAccount, getLink42Url } from "@/lib/authApi"

const LINK_ERROR_MESSAGES: Record<string, string> = {
	campus_identity_already_linked:
		"Esa cuenta de 42 ya está vinculada a otra cuenta de AEDLPH. Inicia sesión con ella, o elimina esta cuenta de invitado.",
	link_session_expired: "La verificación ha caducado. Inténtalo de nuevo.",
	not_in_madrid_campus: "Solo puedes vincular una cuenta de 42 Madrid.",
}

/**
 * The only screen a guest can reach.
 *
 * A guest account is real — it can sign in — but it holds no campus entitlement,
 * so every campus endpoint answers 403. The two actions here are deliberately
 * the only ones available: prove a 42 identity to become a student, or remove
 * the account.
 */
export default function GuestHome() {
	const user = useAuthStore((s) => s.user)
	const clearSession = useAuthStore((s) => s.clearSession)
	const logout = useAuthStore((s) => s.logout)

	const [isLinking, setIsLinking] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const hasReadQueryError = useRef(false)

	useEffect(() => {
		// The callback reports link failures here rather than on /login, since a
		// failed link leaves the guest signed in.
		if (hasReadQueryError.current) {
			return
		}

		hasReadQueryError.current = true
		const param = new URLSearchParams(window.location.search).get("error")

		if (param) {
			setError(LINK_ERROR_MESSAGES[param] ?? `No se ha podido vincular la cuenta de 42: ${param}`)
			window.history.replaceState({}, document.title, "/guest")
		}
	}, [])

	const handleLink = () => {
		setIsLinking(true)
		window.location.href = getLink42Url()
	}

	const handleDelete = async () => {
		setError(null)
		setIsDeleting(true)

		try {
			await deleteAccount()
			clearSession()
			window.location.href = "/login"
		} catch (deleteError) {
			setError(deleteError instanceof Error ? deleteError.message : "No se ha podido eliminar la cuenta")
			setIsDeleting(false)
		}
	}

	return (
		<AuthShell
			title="Cuenta de invitado"
			subtitle={user?.email ?? "Tu cuenta está creada, pero aún sin acceso."}
			footer={
				<button
					onClick={() => void logout()}
					className="cursor-pointer text-xs text-text-secondary hover:text-accent"
				>
					Cerrar sesión
				</button>
			}
		>
			<p className="text-sm text-text-secondary text-center">
				Para ver coaliciones, rankings, perfiles y amigos necesitas vincular tu cuenta de 42.
				Así confirmamos que eres estudiante del campus.
			</p>

			<button
				onClick={handleLink}
				disabled={isLinking || isDeleting}
				className="cursor-pointer flex items-center justify-center gap-3 w-full py-3 px-6 rounded-lg bg-accent/10 border border-accent/30 text-accent font-semibold hover:bg-accent/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{isLinking ? (
					<span className="animate-pulse">Redirigiendo...</span>
				) : (
					<>
						Vincular con
						<img src="/42_logo.svg" alt="Logo 42" className="w-5 h-5" />
					</>
				)}
			</button>

			<div className="flex items-center gap-3">
				<span className="h-px flex-1 bg-border" />
				<span className="text-xs text-text-secondary">o</span>
				<span className="h-px flex-1 bg-border" />
			</div>

			{confirmingDelete ? (
				<div className="flex flex-col gap-3 rounded-lg border border-[#ff355b]/40 bg-[#ff355b]/5 p-3">
					<p className="text-sm text-text text-center">
						¿Seguro? Esta acción es permanente y no se puede deshacer.
					</p>
					<div className="flex gap-2">
						<button
							onClick={() => setConfirmingDelete(false)}
							disabled={isDeleting}
							className="cursor-pointer flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-secondary hover:text-text"
						>
							Cancelar
						</button>
						<button
							onClick={() => void handleDelete()}
							disabled={isDeleting}
							className="cursor-pointer flex-1 rounded-lg border border-[#ff355b] bg-[#ff355b]/15 px-3 py-2 text-sm font-semibold text-text hover:bg-[#ff355b]/40 disabled:opacity-60"
						>
							{isDeleting ? "Eliminando..." : "Sí, eliminar"}
						</button>
					</div>
				</div>
			) : (
				<button
					onClick={() => setConfirmingDelete(true)}
					disabled={isLinking}
					className="cursor-pointer w-full rounded-lg border border-border px-6 py-3 text-sm font-semibold text-text-secondary hover:text-text disabled:opacity-60"
				>
					Eliminar mi cuenta
				</button>
			)}

			{error && <p className="text-center text-sm text-red-500">{error}</p>}
		</AuthShell>
	)
}
