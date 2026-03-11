"use client"

import { useEffect, useState } from "react"

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export default function Home() {
	const [message, setMessage] = useState("Cargando respuesta del servidor...")
	const [hasError, setHasError] = useState(false)

	useEffect(() => {
		let isMounted = true

		async function loadMessage() {
			try {
				const response = await fetch(`${apiUrl}/api/message/`)

				if (!response.ok) {
					throw new Error(`Request failed with status ${response.status}`)
				}

				const data: { message?: string } = await response.json()

				if (isMounted) {
					setMessage(data.message ?? "El servidor no devolvió mensaje")
				}
			} catch {
				if (isMounted) {
					setHasError(true)
					setMessage("No se pudo obtener respuesta del servidor")
				}
			}
		}

		void loadMessage()

		return () => {
			isMounted = false
		}
	}, [])

	return (
		<section className="p-4 space-y-4">
			<h1 className="text-2xl font-bold">Home</h1>
			<p className={hasError ? "text-red-600" : "text-inherit"}>{message}</p>
		</section>
	)
}
