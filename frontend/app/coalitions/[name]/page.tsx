'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { Crown, ArrowLeft } from "lucide-react"

import { useCoalitionStore } from "@/hooks"
import CardContainer from "@/components/CardContainer"

export default function CoalitionDetailPage({
	params,
}: {
	params: Promise<{ name: string }>
}) {
	const { coalitions, maxScore } = useCoalitionStore()
	const [name, setName] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		params.then((p) => {
			setName(p.name)
			setIsLoading(false)
		})
	}, [params])

	const coalition = coalitions.find(
		(c) => c.name.toLowerCase() === name?.toLowerCase()
	)

	if (isLoading || !name) {
		return (
			<section className="p-4">
				<div className="animate-pulse">Loading...</div>
			</section>
		)
	}

	if (!coalition) {
		return (
			<section className="p-4">
				<Link href="/coalitions" className="flex items-center gap-2 text-text-secondary hover:text-text mb-6">
					<ArrowLeft size={20} />
					Back to Coalitions
				</Link>
				<CardContainer className="text-center py-8">
					<p className="text-text-secondary">Coalition "{name}" not found</p>
				</CardContainer>
			</section>
		)
	}

	const formattedPoints = coalition.score > 1000
		? `${(coalition.score / 1000).toFixed(1)}K`
		: coalition.score.toLocaleString("en-US")
	const progression = Math.round((coalition.score / maxScore) * 100)
	const rank = coalitions.sort((a, b) => b.score - a.score).findIndex((c) => c.id === coalition.id) + 1
	const isPositive24h = coalition.scoreChange24h >= 0

	return (
		<section className="py-8 space-y-8">
			<Link href="/coalitions" className="flex items-center gap-2 text-text-secondary hover:text-text transition-colors">
				<ArrowLeft size={20} />
				Volver a Coaliciones
			</Link>

			<div className="relative h-64 rounded-lg overflow-hidden">
				<img
					src={coalition.coverUrl}
					alt={coalition.name}
					className="w-full h-full object-cover"
				/>
				<div className="absolute inset-0 bg-black/40 flex items-end p-8">
					<div className="flex items-end justify-between w-full">
						<div className="flex items-center gap-4">
							<img
								src={coalition.imageUrl}
								alt={coalition.name}
								className="w-20 h-20 rounded-lg bg-card p-1"
							/>
							<div>
								<div className="flex items-start gap-2">
									<h1 className="text-4xl font-bold text-white">{coalition.name}</h1>
									{rank === 1 && <Crown fill="text-yellow-400" className="text-yellow-400" size={20} />}
								</div>
								<p className="text-white/80">Ranking #{rank}</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-4 gap-4">
				<CardContainer className="p-6 text-center">
					<p className="text-text-secondary text-sm mb-2 uppercase font-semibold">Puntuación Total</p>
					<p className="text-4xl font-bold">{formattedPoints}</p>
					{rank === 1 ? (
						<p className="text-xs text-yellow-400 mt-2">Líder</p>
					) : (
						<p className="text-xs text-text-secondary mt-2">{progression}% vs líder</p>
					)}
				</CardContainer>
				<CardContainer className="p-6 text-center">
					<p className="text-text-secondary text-sm mb-2 uppercase font-semibold">Miembros</p>
					<p className="text-4xl font-bold">{coalition.memberCount}</p>
					<p className="text-xs text-green-500 mt-2">+{coalition.memberGrowth} este mes</p>
				</CardContainer>
				<CardContainer className="p-6 text-center">
					<p className="text-text-secondary text-sm mb-2 uppercase font-semibold">Nivel Promedio</p>
					<p className="text-4xl font-bold">{coalition.averageLevel.toFixed(1)}</p>
					<p className="text-xs text-text-secondary mt-2">{coalition.activeMembers} activos</p>
				</CardContainer>
				<CardContainer className="p-6 text-center">
					<p className="text-text-secondary text-sm mb-2 uppercase font-semibold">Cambio 24h</p>
					<p className={`text-4xl font-bold ${isPositive24h ? 'text-green-500' : 'text-red-500'}`}>
						{isPositive24h ? '+' : ''}{(coalition.scoreChange24h / 1000).toFixed(0)}k
					</p>
				</CardContainer>
			</div>

			<CardContainer className="p-6">
				<p className="text-text-secondary text-sm uppercase font-semibold mb-6">Progresión de Puntos</p>
				<div className="grid grid-cols-3 gap-4">
					<div className="bg-surface p-4 rounded">
						<p className="text-xs text-text-secondary mb-2 uppercase">Últimas 24h</p>
						<p className={`text-2xl font-bold ${coalition.scoreChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
							{coalition.scoreChange24h >= 0 ? '+' : ''}{(coalition.scoreChange24h / 1000).toFixed(1)}k
						</p>
					</div>
					<div className="bg-surface p-4 rounded">
						<p className="text-xs text-text-secondary mb-2 uppercase">Esta Semana</p>
						<p className="text-2xl font-bold text-green-500">+{(coalition.scoreChangeWeekly / 1000).toFixed(0)}k</p>
					</div>
					<div className="bg-surface p-4 rounded">
						<p className="text-xs text-text-secondary mb-2 uppercase">Este Mes</p>
						<p className="text-2xl font-bold text-green-500">+{(coalition.scoreChangeMonthly / 1000).toFixed(0)}k</p>
					</div>
				</div>
			</CardContainer>

			{/* <CardContainer className="p-6">
				<p className="text-text-secondary text-sm uppercase font-semibold mb-6">Distribución de Niveles</p>
				<div className="space-y-3">
					{coalition.levelDistribution.map((dist, i) => (
						<div key={i}>
							<div className="flex justify-between items-center mb-1">
								<span className="text-sm font-medium">Nivel {dist.range}</span>
								<span className="text-sm font-bold">{dist.count} miembros</span>
							</div>
							<div className="w-full h-2 bg-border rounded overflow-hidden">
								<div
									className="h-full rounded"
									style={{
										width: `${(dist.count / coalition.memberCount) * 100}%`,
										backgroundColor: coalition.color
									}}
								></div>
							</div>
						</div>
					))}
				</div>
			</CardContainer>

			<CardContainer className="p-6">
				<p className="text-text-secondary text-sm uppercase font-semibold mb-6">Top Miembros</p>
				<div className="space-y-3">
					{coalition.topMembers.map((member, i) => (
						<div key={i} className="flex items-center justify-between p-4 bg-surface rounded">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-linear-to-br flex items-center justify-center font-bold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${coalition.color}, ${coalition.color}80)` }}>
									#{i + 1}
								</div>
								<div>
									<p className="font-semibold">{member.login}</p>
									<p className="text-xs text-text-secondary">Nivel {member.level}</p>
								</div>
							</div>
							<div className="text-right">
								<p className="font-bold">{(member.points / 1000).toFixed(1)}k pts</p>
								<p className="text-xs text-text-secondary">{Math.round((member.points / coalition.score) * 100)}% del total</p>
							</div>
						</div>
					))}
				</div>
			</CardContainer>

			<CardContainer className="p-6">
				<p className="text-text-secondary text-sm uppercase font-semibold mb-6">Todos los Miembros ({coalition.allMembers.length})</p>
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
					{coalition.allMembers.map((member, i) => (
						<div key={i} className="p-3 bg-surface rounded text-center hover:bg-card-hover transition-colors">
							<p className="font-semibold text-sm">{member.login}</p>
							<p className="text-xs text-text-secondary">Lvl {member.level}</p>
							<p className="text-xs font-semibold mt-1">{(member.points / 1000).toFixed(0)}k</p>
						</div>
					))}
				</div>
			</CardContainer> */}
		</section>
	)
}
