"use client"

import { useState } from "react"

import CardContainer from "@/components/CardContainer"
import { useAuthStore } from "@/hooks/useAuth"
import { getLoginUrl } from "@/lib/authApi"

export default function Login() {
	const [isLoading, setIsLoading] = useState(false)

	const error = useAuthStore((s) => s.error)

	const handleLogin = () => {
		setIsLoading(true)
		window.location.href = getLoginUrl()
	};

	return (
		<section className="min-h-screen bg-surface flex items-center justify-center px-4">
			<div className="w-full max-w-sm flex flex-col items-center gap-8">

				<div className="flex flex-col items-center gap-2">
					<span className="text-4xl font-black tracking-tight text-accent">AEDLPH</span>
					<span className="text-sm text-text-secondary">
						Improved 42 Coalitions
					</span>
				</div>

				<CardContainer className="w-full flex flex-col gap-6">
					<div className="flex flex-col gap-1 text-center">
						<h1 className="text-xl font-bold">Iniciar sesión</h1>
						<p className="text-sm text-text-secondary">
							Accede con tu cuenta de 42.
						</p>
					</div>

					<button
						onClick={handleLogin}
						disabled={isLoading}
						className="cursor-pointer flex items-center justify-center gap-3 w-full py-3 px-6 rounded-lg bg-accent/10 border border-accent/30 text-accent font-semibold hover:bg-accent/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{isLoading ? (
							<span className="animate-pulse">Redirigiendo...</span>
						) : (
							<>
								Acceder con
								<img src="/42_logo.svg" alt="Logo 42" className="w-5 h-5" />
							</>
						)}
					</button>

					{error && (
						<p className="text-sm text-red-500 text-center">{error}</p>
					)}
				</CardContainer>

				<p className="text-xs text-text-secondary text-center">
					Acceso limitado a estudiantes de <a href="https://www.42madrid.com/" target="_blank" className="text-accent hover:underline">42 Madrid</a>
				</p>
			</div>
		</section>
	)
}