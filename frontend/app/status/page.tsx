'use client'

import { useEffect, useState } from "react"
import CardContainer from "@/components/CardContainer"
import StatCard from "@/components/StatCard"
import { fetchSystemStatus, SystemStatus } from "@/lib/statusApi"

const formatDateTime = (value: string | null) => {
	if (!value) return "Sin datos"

	return new Intl.DateTimeFormat("es-ES", {
		dateStyle: "medium",
		timeStyle: "medium",
	}).format(new Date(value))
}

export default function StatusPage() {
	const [status, setStatus] = useState<SystemStatus | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		let isMounted = true

		const loadStatus = async () => {
			setIsLoading(true)
			try {
				const payload = await fetchSystemStatus()
				if (!isMounted) return
				setStatus(payload)
				setError(null)
			} catch (err) {
				if (!isMounted) return
				setStatus(null)
				setError(err instanceof Error ? err.message : "No se pudo cargar el estado")
			} finally {
				if (isMounted) {
					setIsLoading(false)
				}
			}
		}

		void loadStatus()

		return () => {
			isMounted = false
		}
	}, [])

	const isHealthy = status?.status === "ok" && status.database === "ok"

	return (
		<section className="py-8 space-y-6">
			<div>
				<p className="text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary">System status</p>
				<h1 className="mt-2 text-4xl font-black">Estado de AEDLPH</h1>
				<p className="mt-3 max-w-2xl text-text-secondary">
					Estado real obtenido desde <code>/api/status/</code> con la salud del backend, la base de datos y la ultima sincronizacion registrada.
				</p>
			</div>

			{isLoading ? (
				<CardContainer className="p-8">
					<p className="text-text-secondary">Comprobando servicios...</p>
				</CardContainer>
			) : null}

			{error ? (
				<CardContainer className="border-red-500/50 bg-red-500/10 p-8">
					<p className="text-sm font-semibold uppercase text-red-400">Error</p>
					<p className="mt-2 text-lg font-bold">No se pudo obtener el estado del sistema</p>
					<p className="mt-2 text-text-secondary">{error}</p>
				</CardContainer>
			) : null}

			{status ? (
				<>
					<CardContainer className={`p-8 ${isHealthy ? 'border-green-500/50' : 'border-red-500/50'}`}>
						<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<div>
								<p className="text-sm font-semibold uppercase text-text-secondary">Estado general</p>
								<p className={`mt-2 text-5xl font-black ${isHealthy ? 'text-green-500' : 'text-red-500'}`}>
									{isHealthy ? "Operativo" : "Degradado"}
								</p>
							</div>
							<div className={`rounded-full px-4 py-2 text-sm font-bold uppercase ${isHealthy ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
								{status.status}
							</div>
						</div>
					</CardContainer>

					<div className="grid gap-4 md:grid-cols-3">
						<StatCard
							title="Backend"
							value={status.status.toUpperCase()}
							valueClassName={status.status === "ok" ? "text-3xl font-black text-green-500" : "text-3xl font-black text-red-500"}
						/>
						<StatCard
							title="Base de datos"
							value={status.database.toUpperCase()}
							valueClassName={status.database === "ok" ? "text-3xl font-black text-green-500" : "text-3xl font-black text-red-500"}
						/>
						<StatCard
							title="Servicio"
							value={status.service}
							valueClassName="text-2xl font-black"
						/>
					</div>

					<CardContainer className="p-8">
						<div className="grid gap-6 md:grid-cols-2">
							<div>
								<p className="text-sm font-semibold uppercase text-text-secondary">Ultimo sync</p>
								<p className="mt-2 text-xl font-bold">{formatDateTime(status.last_sync)}</p>
							</div>
							<div>
								<p className="text-sm font-semibold uppercase text-text-secondary">Ultima comprobacion</p>
								<p className="mt-2 text-xl font-bold">{formatDateTime(status.timestamp)}</p>
							</div>
						</div>
					</CardContainer>
				</>
			) : null}
		</section>
	)
}
