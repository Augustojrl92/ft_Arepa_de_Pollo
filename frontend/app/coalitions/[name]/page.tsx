'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { Crown, ArrowLeft } from "lucide-react"

import { useCoalitionStore } from "@/hooks"
import CardContainer from "@/components/CardContainer"
import CustomButton from "@/components/CustomButton"
import StatCard from "@/components/StatCard"
import PointsEvolutionChart from "@/app/coalitions/_components/PointsEvolutionChart"

export default function CoalitionDetailPage({
	params,
}: {
	params: Promise<{ name: string }>
}) {
	const { coalitions, maxScore, getCoalitionDetails } = useCoalitionStore()
	const [name, setName] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		params.then((p) => {
			setName(p.name)
			setIsLoading(false)
		})
	}, [params])

	useEffect(() => {
		if (!name) return

		const coalition = coalitions.find(
			(c) => c.name.toLowerCase() === name.toLowerCase()
		)

		if (!coalition) return

		if (!coalition.details) {
			void getCoalitionDetails(coalition.slug)
		}
	}, [coalitions, getCoalitionDetails, name])

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
	const progression = maxScore > 0 ? maxScore - coalition.score : 0
	const rank = coalition.details?.campusRank ?? "N/A"
	const scoreChange24h = coalition.details?.scoreChange24h ?? 0
	const scoreChangeWeekly = coalition.details?.scoreChangeWeekly ?? 0
	const scoreChangeMonthly = coalition.details?.scoreChangeMonthly ?? 0
	const isPositive24h = scoreChange24h >= 0

	const withOpacity = (color: string, opacity: number): string => {
		const hex = color.replace('#', '')
		if (!/^[0-9a-fA-F]+$/.test(hex)) return color

		const normalized = hex.length === 3
			? hex.split('').map((char) => `${char}${char}`).join('')
			: hex

		if (normalized.length !== 6) return color

		const r = Number.parseInt(normalized.slice(0, 2), 16)
		const g = Number.parseInt(normalized.slice(2, 4), 16)
		const b = Number.parseInt(normalized.slice(4, 6), 16)
		return `rgba(${r}, ${g}, ${b}, ${opacity})`
	}

	const getLevelRangeFromDistribution = (rangeLabel: string): { levelMin: number; levelMax: number } => {
		if (rangeLabel.startsWith('+')) {
			const min = Number.parseInt(rangeLabel.replace('+', ''), 10)
			return { levelMin: Number.isNaN(min) ? 11 : min + 1, levelMax: 25 }
		} else if (!rangeLabel.includes('-')) {
			const max = Number.parseInt(rangeLabel, 10)
			return {
				levelMin: Number.isNaN(max) ? 0 : max,
				levelMax: Number.isNaN(max) ? 25 : max,
			}
		}

		const [minRaw, maxRaw] = rangeLabel.split('-')
		const levelMin = Number.parseInt(minRaw, 10)
		const levelMax = Number.parseInt(maxRaw, 10)

		return {
			levelMin: Number.isNaN(levelMin) ? 0 : levelMin,
			levelMax: Number.isNaN(levelMax) ? 25 : levelMax,
		}
	}

	return (
		<section className="py-8 space-y-8" style={{ '--coalition-color': coalition.color } as React.CSSProperties}>
			<div className="flex items-center justify-between">
				<Link href="/coalitions" className="flex items-center gap-2 text-text-secondary hover:text-text transition-colors">
					<ArrowLeft size={20} />
					Volver a Coaliciones
				</Link>
			</div>

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

			<div className="grid grid-cols-5 gap-4">
				<CardContainer className="p-6 text-center">
					<p className="text-text-secondary text-sm mb-2 uppercase font-semibold">Puntuación Total</p>
					<p className="text-4xl font-bold">{formattedPoints}</p>
					{rank === 1 ? (
						<p className="text-xs text-yellow-400 mt-2">Líder</p>
					) : (
						<p className="text-xs text-text-secondary mt-2">A <span className="text-text">{progression}</span> puntos del líder</p>
					)}
				</CardContainer>
				<CardContainer className="p-6 text-center">
					<p className="text-text-secondary text-sm mb-2 uppercase font-semibold">Miembros Activos</p>
					<p className="text-4xl font-bold">{coalition.details?.activeMembers ?? 0}</p>
					<p className="text-xs text-text-secondary mt-2">{coalition.details?.totalMembers ?? 0} totales</p>
				</CardContainer>
				<CardContainer className="p-6 text-center">
					<p className="text-text-secondary text-sm mb-2 uppercase font-semibold">Correcciones</p>
					<p className="text-4xl font-bold">{(coalition.details?.evaluationsDoneCurrentSeason ?? 0).toLocaleString()}</p>
					<p className="text-xs text-text-secondary mt-2">total {(coalition.details?.evaluationsDoneTotal ?? 0).toLocaleString()}</p>
				</CardContainer>
				<CardContainer className="p-6 text-center">
					<p className="text-text-secondary text-sm mb-2 uppercase font-semibold">Nivel Promedio</p>
					<p className="text-4xl font-bold">{coalition.details?.averageLevel ?? 0}</p>
				</CardContainer>
				<CardContainer className="p-6 text-center">
					<p className="text-text-secondary text-sm mb-2 uppercase font-semibold">Cambio 24h</p>
					<p className={`text-4xl font-bold ${isPositive24h ? 'text-green-500' : 'text-red-500'}`}>
						{isPositive24h ? '+' : ''}{(scoreChange24h / 1000).toFixed(0)}k
					</p>
				</CardContainer>
			</div>

			<CardContainer className="p-6">
				<p className="text-text-secondary text-sm uppercase font-semibold mb-6">Progresión de Puntos</p>
				<div className="grid grid-cols-3 gap-4">
					<StatCard
						title="Últimas 24h"
						value={`${scoreChange24h >= 0 ? '+' : ''}${(scoreChange24h / 1000).toFixed(1)}k`}
						valueClassName={`text-2xl font-bold ${scoreChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}
						className="bg-surface p-4 rounded"
					/>
					<StatCard
						title="Esta Semana"
						value={`${scoreChangeWeekly >= 0 ? '+' : ''}${(scoreChangeWeekly / 1000).toFixed(0)}k`}
						valueClassName={`text-2xl font-bold ${scoreChangeWeekly >= 0 ? 'text-green-500' : 'text-red-500'}`}
						className="bg-surface p-4 rounded"
					/>
					<StatCard
						title="Este Mes"
						value={`${scoreChangeMonthly >= 0 ? '+' : ''}${(scoreChangeMonthly / 1000).toFixed(0)}k`}
						valueClassName={`text-2xl font-bold ${scoreChangeMonthly >= 0 ? 'text-green-500' : 'text-red-500'}`}
						className="bg-surface p-4 rounded"
					/>
				</div>
			</CardContainer>

			<PointsEvolutionChart color={coalition.color} title={`Evolución de Puntos de ${coalition.name}`} />

			<div className="grid grid-cols-2 gap-6">
				<CardContainer className="p-6">
					<p className="text-text-secondary text-sm uppercase font-semibold mb-6">Distribución de Niveles (Activos)</p>
					<div className="flex flex-col gap-4">
						{coalition.details?.levelDistribution.map((dist, i) => {
							const totalMembers = coalition.details?.activeMembers ?? 0
							const widthPercent = totalMembers > 0 ? (dist.count / totalMembers) * 100 : 0
							const { levelMin, levelMax } = getLevelRangeFromDistribution(dist.range)

							return (
								<Link
									key={i}
									href={`/leaderboard?coalition=${encodeURIComponent(coalition.slug)}&levelMin=${levelMin}&levelMax=${levelMax}`}
									className="block rounded-md p-2 -m-2 hover:bg-card-hover/60 transition-colors"
								>
									<div className="flex justify-between items-center mb-2">
										<span className="text-sm text-text">Nivel {dist.range}</span>
										<span className="text-sm font-semibold">{dist.count}</span>
									</div>
									<div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
										<div
											className="h-full rounded-full transition-all duration-300"
											style={{
												width: `${widthPercent}%`,
												backgroundColor: coalition.color,
											}}
										></div>
									</div>
								</Link>
							)
						})}
						<div className="border-t border-border mt-6 pt-4">
							<div className="grid grid-cols-3 gap-3 text-center">
								<div className="flex flex-col">
									<span className="text-xs text-text-secondary uppercase tracking-wide mb-1">Nivel Promedio</span>
									<span className="text-lg font-bold">{coalition.details?.averageLevel?.toFixed(1) ?? 0}</span>
								</div>
								<div className="flex flex-col">
									<span className="text-xs text-text-secondary uppercase tracking-wide mb-1">Activos</span>
									<span className="text-lg font-bold">{coalition.details?.activeMembers ?? 0}</span>
								</div>
								<div className="flex flex-col">
									<span className="text-xs text-text-secondary uppercase tracking-wide mb-1">Total</span>
									<span className="text-lg font-bold">{coalition.details?.totalMembers ?? 0}</span>
								</div>
							</div>
						</div>
					</div>
				</CardContainer>
				<CardContainer className="p-6">
					<p className="text-text-secondary text-sm uppercase font-semibold mb-6">Top Miembros</p>
					<div className="space-y-3">
						{coalition.details?.topMembers.map((member, i) => (
							<Link href={`https://profile.intra.42.fr/users/${member.login}`} target="_blank" key={i} className="flex items-center justify-between p-4 bg-surface rounded-lg group">
								<div className="flex items-center gap-3">
									<img
										src={member.avatar}
										alt={member.displayName}
										className="w-12 h-12 rounded-full bg-card p-1 object-cover group-hover:ring group-hover:ring-(--coalition-color) transition-all"
									/>
									<div>
										<p className="font-semibold group-hover:text-(--coalition-color)">{member.login}</p>
										<p className="text-xs text-text-secondary">Nivel {member.level}</p>
									</div>
								</div>
								<div className="text-right">
									<p className="font-bold">{(member.points / 1000).toFixed(1)}k pts</p>
									<p className="text-xs text-text-secondary">{Math.round((member.points / coalition.score) * 100)}% del total</p>
								</div>
							</Link>
						))}
					</div>
					<div className="flex items-center justify-center mt-8">
						<CustomButton
							href={`/leaderboard?coalition=${encodeURIComponent(coalition.slug)}`}
							variant="coalition"
						>
							Ver ranking de {coalition.name}
						</CustomButton>
					</div>
				</CardContainer>
			</div>
		</section>
	)
}
