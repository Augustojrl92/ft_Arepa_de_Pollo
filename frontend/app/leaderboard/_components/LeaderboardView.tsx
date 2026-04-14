'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Info } from 'lucide-react'
import { useAuthStore, useCoalitionStore } from '@/hooks'
import type { Coalition, RankingEntry } from '@/types'
import { LeaderboardFilters } from './LeaderboardFilters'
import { LeaderboardPagination } from './LeaderboardPagination'

export type LeaderboardViewMode = 'coalition-points' | 'corrections'

type SortField =
	| 'rank'
	| 'coalition'
	| 'login'
	| 'intraLevel'
	| 'coalitionPoints'
	| 'evaluationsDoneCurrentSeason'
	| 'evaluationsDoneTotal'

type LeaderboardRow = RankingEntry & {
	correctionRank?: number
	correctionCoalitionRank?: number
}

const levelUpperBound = 25

const compactNumberFormatter = new Intl.NumberFormat('es-ES', {
	maximumFractionDigits: 1,
	minimumFractionDigits: 0,
})

const formatLeaderboardNumber = (value: number) => {
	if (value >= 1_000_000) {
		return `${compactNumberFormatter.format(value / 1_000_000)}M`
	}

	if (value >= 1_000) {
		return `${compactNumberFormatter.format(value / 1_000)}K`
	}

	return value.toLocaleString('es-ES')
}

const clampLevelValue = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

const parseInitialLevelBounds = (searchParams: ReturnType<typeof useSearchParams>) => {
	const minFromQuery = Number.parseInt(searchParams.get('levelMin') ?? '', 10)
	const maxFromQuery = Number.parseInt(searchParams.get('levelMax') ?? '', 10)
	const safeMin = Number.isNaN(minFromQuery) ? 0 : clampLevelValue(minFromQuery, 0, levelUpperBound)
	const safeMax = Number.isNaN(maxFromQuery) ? levelUpperBound : clampLevelValue(maxFromQuery, 0, levelUpperBound)

	return {
		levelMin: Math.min(safeMin, safeMax),
		levelMax: Math.max(safeMin, safeMax),
	}
}

const parseInitialPointsBounds = (searchParams: ReturnType<typeof useSearchParams>) => {
	const minFromQuery = Number.parseInt(searchParams.get('pointsMin') ?? '', 10)
	const maxFromQuery = Number.parseInt(searchParams.get('pointsMax') ?? '', 10)

	return {
		pointsMin: Number.isNaN(minFromQuery) ? null : minFromQuery,
		pointsMax: Number.isNaN(maxFromQuery) ? null : maxFromQuery,
	}
}

interface LeaderboardViewProps {
	mode: LeaderboardViewMode
}

export const LeaderboardView = ({ mode }: LeaderboardViewProps) => {
	const { coalitions, ranking, rankingMeta, isRankingLoading, getRanking } = useCoalitionStore()
	const { user } = useAuthStore()
	const searchParams = useSearchParams()
	const [search, setSearch] = useState('')
	const [selectedCoalitions, setSelectedCoalitions] = useState<string[]>([])
	const initialLevelBounds = parseInitialLevelBounds(searchParams)
	const initialPointsBounds = parseInitialPointsBounds(searchParams)
	const [levelMin, setLevelMin] = useState(initialLevelBounds.levelMin)
	const [levelMax, setLevelMax] = useState(initialLevelBounds.levelMax)
	const [pointsMin, setPointsMin] = useState<number | null>(initialPointsBounds.pointsMin)
	const [pointsMax, setPointsMax] = useState<number | null>(initialPointsBounds.pointsMax)
	const [sortBy, setSortBy] = useState<SortField>('rank')
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
	const [page, setPage] = useState(1)
	const [perPage, setPerPage] = useState(25)
	const [isRankInfoOpen, setIsRankInfoOpen] = useState(false)
	const rankInfoRef = useRef<HTMLDivElement | null>(null)

	const coalitionBySlug = useMemo(
		() => new Map(coalitions.map((coalition) => [coalition.slug, coalition])),
		[coalitions]
	)

	useEffect(() => {
		if (ranking.length === 0) {
			void getRanking()
		}
	}, [getRanking, ranking.length])

	useEffect(() => {
		const coalitionFromQuery = searchParams.get('coalition')
		if (coalitionFromQuery) {
			const coalitionExists = coalitions.some((coalition) => coalition.slug === coalitionFromQuery)
			if (coalitionExists) {
				setSelectedCoalitions([coalitionFromQuery])
			}
		}

		const { levelMin: nextLevelMin, levelMax: nextLevelMax } = parseInitialLevelBounds(searchParams)
		setLevelMin(nextLevelMin)
		setLevelMax(nextLevelMax)
		setPage(1)
	}, [coalitions, searchParams])

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (!rankInfoRef.current) {
				return
			}

			if (!rankInfoRef.current.contains(event.target as Node)) {
				setIsRankInfoOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [])

	useEffect(() => {
		if (mode === 'coalition-points' && (sortBy === 'evaluationsDoneCurrentSeason' || sortBy === 'evaluationsDoneTotal')) {
			setSortBy('rank')
			setSortDir('asc')
		}

		if (mode === 'corrections' && sortBy === 'coalitionPoints') {
			setSortBy('rank')
			setSortDir('asc')
		}
	}, [mode, sortBy])

	const currentUserCoalition = useMemo(
		() => coalitions.find((coalition) => coalition.slug === user?.coalition),
		[coalitions, user?.coalition]
	)

	const minPointsLvl = ranking.length > 0
		? ranking.reduce((min, currentUser) => Math.min(min, currentUser.coalitionPoints), Number.MAX_SAFE_INTEGER)
		: 0
	const maxPointsLvl = ranking.length > 0
		? ranking.reduce((max, currentUser) => Math.max(max, currentUser.coalitionPoints), Number.MIN_SAFE_INTEGER)
		: 0

	const effectivePointsMin = pointsMin ?? minPointsLvl
	const effectivePointsMax = pointsMax ?? maxPointsLvl

	const rankingWithCorrectionRanks = useMemo<LeaderboardRow[]>(() => {
		const sortedByCorrections = [...ranking].sort((leftUser, rightUser) => {
			if (rightUser.evaluationsDoneCurrentSeason !== leftUser.evaluationsDoneCurrentSeason) {
				return rightUser.evaluationsDoneCurrentSeason - leftUser.evaluationsDoneCurrentSeason
			}

			if (rightUser.evaluationsDoneTotal !== leftUser.evaluationsDoneTotal) {
				return rightUser.evaluationsDoneTotal - leftUser.evaluationsDoneTotal
			}

			return leftUser.login.localeCompare(rightUser.login)
		})

		const globalRankByLogin = new Map<string, number>()
		const coalitionRankByLogin = new Map<string, number>()
		const coalitionCounters = new Map<string, number>()

		sortedByCorrections.forEach((entry, index) => {
			globalRankByLogin.set(entry.login, index + 1)
			const nextCoalitionRank = (coalitionCounters.get(entry.coalition) ?? 0) + 1
			coalitionCounters.set(entry.coalition, nextCoalitionRank)
			coalitionRankByLogin.set(entry.login, nextCoalitionRank)
		})

		return ranking.map((entry) => ({
			...entry,
			correctionRank: globalRankByLogin.get(entry.login) ?? entry.rank,
			correctionCoalitionRank: coalitionRankByLogin.get(entry.login) ?? entry.coalitionRank,
		}))
	}, [ranking])

	const activeRanking: LeaderboardRow[] = mode === 'corrections' ? rankingWithCorrectionRanks : ranking

	const filteredRanking: LeaderboardRow[] = activeRanking.filter((rankingUser) => {
		const passSearch =
			search.trim().length === 0 ||
			rankingUser.login.toLowerCase().includes(search.toLowerCase()) ||
			rankingUser.displayName.toLowerCase().includes(search.toLowerCase())

		const passCoalition =
			selectedCoalitions.length === 0 || selectedCoalitions.includes(rankingUser.coalition)

		const passLevel = rankingUser.intraLevel >= levelMin && rankingUser.intraLevel <= levelMax
		const passPoints = mode === 'corrections'
			? true
			: rankingUser.coalitionPoints >= effectivePointsMin && rankingUser.coalitionPoints <= effectivePointsMax

		return passSearch && passCoalition && passLevel && passPoints
	})

	const sortedRanking: LeaderboardRow[] = [...filteredRanking].sort((leftUser, rightUser) => {
		const leftValue = mode === 'corrections' && sortBy === 'rank'
			? leftUser.correctionRank ?? leftUser.rank
			: leftUser[sortBy as keyof typeof leftUser]
		const rightValue = mode === 'corrections' && sortBy === 'rank'
			? rightUser.correctionRank ?? rightUser.rank
			: rightUser[sortBy as keyof typeof rightUser]

		if (typeof leftValue === 'string' && typeof rightValue === 'string') {
			return sortDir === 'asc' ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue)
		}

		return sortDir === 'asc'
			? (leftValue as number) - (rightValue as number)
			: (rightValue as number) - (leftValue as number)
	})

	const localTotalPages = Math.max(Math.ceil(sortedRanking.length / perPage), 1)
	const safePage = Math.min(page, localTotalPages)
	const paginatedUsers = sortedRanking.slice((safePage - 1) * perPage, safePage * perPage)
	const hasAppliedFilters =
		search.trim().length > 0 ||
		selectedCoalitions.length > 0 ||
		levelMin > 0 ||
		levelMax < levelUpperBound ||
		(mode === 'coalition-points' && (effectivePointsMin > minPointsLvl || effectivePointsMax < maxPointsLvl))

	const usersRangeStart = sortedRanking.length === 0 ? 0 : ((safePage - 1) * perPage) + 1
	const usersRangeEnd = sortedRanking.length === 0 ? 0 : Math.min(safePage * perPage, sortedRanking.length)

	const totalPoints = sortedRanking.reduce((sum, rankingUser) => sum + rankingUser.coalitionPoints, 0)
	const totalCurrentSeasonCorrections = sortedRanking.reduce((sum, rankingUser) => sum + rankingUser.evaluationsDoneCurrentSeason, 0)
	const totalLifetimeCorrections = sortedRanking.reduce((sum, rankingUser) => sum + rankingUser.evaluationsDoneTotal, 0)
	const avgLevel =
		sortedRanking.length > 0
			? sortedRanking.reduce((sum, rankingUser) => sum + rankingUser.intraLevel, 0) / sortedRanking.length
			: 0

	const currentUserCorrectionEntry = rankingWithCorrectionRanks.find((entry) => entry.login === user?.login)

	useEffect(() => {
		if (page > localTotalPages) {
			setPage(localTotalPages)
		}
	}, [localTotalPages, page])

	const handleCoalitionToggle = (slug: string) => {
		setPage(1)
		setSelectedCoalitions((current) =>
			current.includes(slug)
				? current.filter((item) => item !== slug)
				: [...current, slug]
		)
	}

	const clearFilters = () => {
		setSearch('')
		setSelectedCoalitions([])
		setLevelMin(0)
		setLevelMax(levelUpperBound)
		setPointsMin(null)
		setPointsMax(null)
		setSortBy('rank')
		setSortDir('asc')
		setPage(1)
	}

	const handleSort = (field: SortField) => {
		setPage(1)
		if (sortBy === field) {
			setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
			return
		}

		setSortBy(field)
		setSortDir('asc')
	}

	const currentUserRank = mode === 'corrections'
		? currentUserCorrectionEntry?.correctionRank ?? '-'
		: user?.campusUserRank ?? '-'
	const currentCoalitionRank = mode === 'corrections'
		? currentUserCorrectionEntry?.correctionCoalitionRank ?? '-'
		: user?.coalitionUserRank ?? '-'

	if (isRankingLoading && ranking.length === 0) {
		return (
			<div className="w-full mx-auto max-w-400 px-4 md:px-6 py-4">
				<div className="animate-pulse space-y-6">
					<div className="h-10 bg-surface-elevated rounded w-1/3" />
					<div className="h-32 bg-surface-elevated rounded" />
					<div className="h-96 bg-surface-elevated rounded" />
				</div>
			</div>
		)
	}

	if (!ranking || ranking.length === 0) {
		return <div className="text-text-secondary mt-6">No hay usuarios para mostrar.</div>
	}

	return (
		<div className="w-full mx-auto max-w-400 px-4 md:px-6 py-4">
			<div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-extrabold text-text tracking-tight">
						{mode === 'corrections' ? 'Clasificacion de Correcciones' : 'Clasificacion Global'}
					</h1>
					<p className="text-text-secondary mt-1">
						{mode === 'corrections'
							? 'Temporada actual de evaluaciones'
							: 'Temporada actual de coaliciones'}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<div className="px-4 py-2 bg-card border border-border rounded-lg flex items-center gap-3">
						<span className="text-xs font-bold text-text-secondary uppercase">
							{mode === 'corrections' ? 'Mi Ranking en correcciones' : `Mi Ranking en ${user?.coalition ?? 'mi coalicion'}`}
						</span>
						<span className="font-mono font-bold" style={{ color: currentUserCoalition?.color }}>
							#{currentCoalitionRank}
						</span>
					</div>
					<div className="px-4 py-2 bg-card border border-border rounded-lg flex items-center gap-3">
						<span className="text-xs font-bold text-text-secondary uppercase">
							{mode === 'corrections' ? 'Mi Ranking en Madrid' : 'Mi Ranking en Madrid'}
						</span>
						<span className="text-accent font-mono font-bold">#{currentUserRank}</span>
					</div>
				</div>
			</div>

			<div className="flex flex-col lg:flex-row gap-6">
				<LeaderboardFilters
					coalitions={coalitions}
					levelMax={levelMax}
					levelMin={levelMin}
					levelUpperBound={levelUpperBound}
					maxPointsLvl={maxPointsLvl}
					minPointsLvl={minPointsLvl}
					pointsMax={effectivePointsMax}
					pointsMin={effectivePointsMin}
					hasAppliedFilters={hasAppliedFilters}
					showPointsRange={mode === 'coalition-points'}
					onClearFilters={clearFilters}
					onLevelMaxChange={(value) => {
						setLevelMax(value)
						setPage(1)
					}}
					onLevelMinChange={(value) => {
						setLevelMin(value)
						setPage(1)
					}}
					onPointsMaxChange={(value) => {
						setPointsMax(value)
						setPage(1)
					}}
					onPointsMinChange={(value) => {
						setPointsMin(value)
						setPage(1)
					}}
					onSearchChange={(value) => {
						setSearch(value)
						setPage(1)
					}}
					onToggleCoalition={handleCoalitionToggle}
					search={search}
					selectedCoalitions={selectedCoalitions}
				/>

				<section className="flex-1">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
						<div className="bg-card p-4 rounded-xl border border-border relative overflow-hidden">
							<span className="text-[10px] font-bold text-text-secondary uppercase">Total Usuarios</span>
							<div className="text-2xl font-black text-text">{sortedRanking.length.toLocaleString('es-ES')}</div>
						</div>
						<div className="bg-card p-4 rounded-xl border border-border relative overflow-hidden">
							<span className="text-[10px] font-bold text-text-secondary uppercase">
								{mode === 'corrections' ? 'Correcciones temporada' : 'Puntos Totales'}
							</span>
							<div className="text-2xl font-black text-accent">
								{mode === 'corrections'
									? totalCurrentSeasonCorrections.toLocaleString('es-ES')
									: Math.round(totalPoints).toLocaleString('es-ES')}
							</div>
						</div>
						<div className="bg-card p-4 rounded-xl border border-border relative overflow-hidden">
							<span className="text-[10px] font-bold text-text-secondary uppercase">
								{mode === 'corrections' ? 'Correcciones totales' : 'Nivel Promedio'}
							</span>
							<div className="text-2xl font-black text-text">
								{mode === 'corrections'
									? totalLifetimeCorrections.toLocaleString('es-ES')
									: avgLevel.toFixed(2)}
							</div>
						</div>
					</div>

					<div className="bg-card rounded-xl border border-border overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full text-left border-collapse min-w-205">
								<thead>
									<tr className="bg-background text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border">
										<th className="px-6 py-4">
											<div ref={rankInfoRef} className="relative inline-flex items-center gap-1">
												<button
													type="button"
													onClick={() => setIsRankInfoOpen((current) => !current)}
													aria-label="Mostrar informacion de ranking"
													aria-expanded={isRankInfoOpen}
													className="inline-flex items-center hover:text-accent transition-colors pr-1"
												>
													<Info size={15} />
												</button>
												<button
													type="button"
													onClick={() => handleSort('rank')}
													className="inline-flex items-center gap-1 hover:text-text transition-colors"
												>
													<span>{mode === 'corrections' ? 'Ranking Correcciones (M/C)' : 'Ranking (M/C)'}</span>
													<span className="text-[9px]">{sortBy === 'rank' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
												</button>
												<span
													role="tooltip"
													className={`absolute left-0 top-full z-20 mt-2 w-64 rounded-md border border-border bg-card p-2 text-[12px] normal-case tracking-normal text-text-secondary shadow-lg transition-opacity ${isRankInfoOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
												>
													M = Ranking Madrid | C = Ranking dentro de su coalicion
												</span>
											</div>
									</th>
									<th className="px-6 py-4">
										<button
											type="button"
											onClick={() => handleSort('login')}
											className="inline-flex items-center gap-1 hover:text-text transition-colors"
										>
											<span>Usuario</span>
											<span className="text-[9px]">{sortBy === 'login' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th className="px-6 py-4">
										<button
											type="button"
											onClick={() => handleSort('coalition')}
											className="inline-flex items-center gap-1 hover:text-text transition-colors"
										>
											<span>Coalicion</span>
											<span className="text-[9px]">{sortBy === 'coalition' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th className="px-6 py-4 text-center">
										<button
											type="button"
											onClick={() => handleSort('intraLevel')}
											className="inline-flex items-center gap-1 hover:text-text transition-colors"
										>
											<span>Nivel</span>
											<span className="text-[9px]">{sortBy === 'intraLevel' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									{mode === 'corrections' ? (
										<th className="px-6 py-4 text-right">
											<div className="inline-flex items-center gap-2">
												<button
													type="button"
													onClick={() => handleSort('evaluationsDoneCurrentSeason')}
													className="inline-flex items-center gap-1 hover:text-text transition-colors"
												>
													<span>Temporada</span>
													<span className="text-[9px]">{sortBy === 'evaluationsDoneCurrentSeason' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
												</button>
												<span>|</span>
												<button
													type="button"
													onClick={() => handleSort('evaluationsDoneTotal')}
													className="inline-flex items-center gap-1 hover:text-text transition-colors"
												>
													<span>Totales</span>
													<span className="text-[9px]">{sortBy === 'evaluationsDoneTotal' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
												</button>
											</div>
										</th>
									) : (
										<th className="px-6 py-4 text-right">
											<button
												type="button"
												onClick={() => handleSort('coalitionPoints')}
												className="inline-flex items-center gap-1 hover:text-text transition-colors"
											>
												<span>Puntos</span>
												<span className="text-[9px]">{sortBy === 'coalitionPoints' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
											</button>
										</th>
									)}
								</tr>
								</thead>
								<tbody className="divide-y divide-border text-sm">
									{paginatedUsers.map((rankingUser) => {
										const coalition = coalitionBySlug.get(rankingUser.coalition)
										const isCurrentUser = rankingUser.login === user?.login
										const rankValue = mode === 'corrections'
											? rankingUser.correctionRank ?? rankingUser.rank
											: rankingUser.rank
										const coalitionRankValue = mode === 'corrections'
											? rankingUser.correctionCoalitionRank ?? rankingUser.coalitionRank
											: rankingUser.coalitionRank

										return (
											<tr key={rankingUser.login} className={`group transition-colors hover:bg-card-hover/70 ${isCurrentUser ? 'bg-accent/10' : ''}`}>
												<td className="px-6 py-4 font-mono font-regular">
													<span className="text-accent">{String(rankValue).padStart(2, '0')}</span> | <span style={{ color: coalition?.color || 'var(--color-text-secondary)' }}>{String(coalitionRankValue).padStart(2, '0')}</span>
												</td>
												<td className="px-6 py-4">
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 rounded-full bg-background shrink-0 overflow-hidden border border-border">
															<img
																src={rankingUser.avatar}
																alt={rankingUser.displayName || rankingUser.login}
																className="w-full h-full object-cover"
															/>
														</div>
														<a
															href={`https://profile.intra.42.fr/users/${rankingUser.login}`}
															target="_blank"
															rel="noreferrer"
															className="font-semibold text-text group-hover:text-accent transition-colors"
														>
															{rankingUser.login}
														</a>
													</div>
												</td>
												<td className="px-6 py-4">
													<Link
														href={`/coalitions/${coalition?.slug || rankingUser.coalition}`}
														className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border"
														style={{
															color: coalition?.color || 'var(--color-text-secondary)',
															borderColor: coalition?.color || 'var(--color-border)',
															backgroundColor: coalition?.color ? `${coalition.color}1a` : 'var(--color-card)',
														}}
													>
														<span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: coalition?.color || '#94a3b8' }} />
														{coalition?.name || rankingUser.coalition}
													</Link>
												</td>
												<td className="px-6 py-4 text-center font-mono">{rankingUser.intraLevel.toFixed(2)}</td>
												<td className="px-6 py-4 text-right font-mono font-medium text-text">
													{mode === 'corrections'
														? `${rankingUser.evaluationsDoneCurrentSeason.toLocaleString('es-ES')} | ${rankingUser.evaluationsDoneTotal.toLocaleString('es-ES')}`
														: rankingUser.coalitionPoints.toLocaleString('es-ES')}
												</td>
											</tr>
										)
									})}
									{paginatedUsers.length === 0 && (
										<tr>
											<td colSpan={5} className="px-6 py-4 text-center text-text">
												No hay usuarios que coincidan con los filtros aplicados.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>

						<LeaderboardPagination
							currentPage={safePage}
							onNext={() => setPage((current) => Math.min(localTotalPages, current + 1))}
							onPerPageChange={(value) => {
								setPerPage(value)
								setPage(1)
							}}
							onPrevious={() => setPage((current) => Math.max(1, current - 1))}
							perPage={perPage}
							summary={hasAppliedFilters
								? `Mostrando ${usersRangeStart}-${usersRangeEnd} de ${sortedRanking.length} usuarios filtrados`
								: `Mostrando ${usersRangeStart}-${usersRangeEnd} de ${rankingMeta.total} usuarios`}
							totalPages={localTotalPages}
						/>
					</div>
				</section>
			</div>
		</div>
	)
}
