"use client"

import { useEffect, useRef, useState } from "react"

import { usePathname } from 'next/navigation';

import CardContainer from "@/components/CardContainer"
import { getLoginUrl } from "@/lib/authApi"

export default function Login() {
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const hasProcessedQueryError = useRef(false)
	const pathname = usePathname();

	const handleLogin = () => {
		setIsLoading(true)
		window.location.href = getLoginUrl()
	};

	useEffect(() => {
		if (hasProcessedQueryError.current) {
			return
		}

		hasProcessedQueryError.current = true
		const errorParam = new URLSearchParams(window.location.search).get('error')

		switch (errorParam) {
			case 'oauth_failed':
				setError('Error de autenticación con 42. Por favor, inténtalo de nuevo.')
				break
			case 'not_in_campus_db':
				setError('Tu cuenta de 42 no está registrada en nuestra base de datos')
				break
			case 'not_in_madrid_campus':
				setError('Solo puedes acceder con una cuenta de 42 Madrid')
				break
			default:
				break
		}

		if (window.location.search) {
			window.history.replaceState({}, document.title, `${pathname}${window.location.hash}`)
		}
	}, [pathname]);


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
						<div className="flex flex-col items-center gap-4 text-center">
							<p className="text-[16px] text-red-500 ">{error}</p>
							<p className="text-xs text-text-secondary">
								Si crees que es un error, contacta con soporte.
							</p>
						</div>
					)}
				</CardContainer>

				<p className="text-xs text-text-secondary text-center">
					Acceso limitado a estudiantes de <a href="https://www.42madrid.com/" target="_blank" className="text-accent hover:underline">42 Madrid</a>
				</p>
			</div>
		</section>
	)
}