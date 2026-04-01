
import { useEffect, useMemo, useState } from "react"
import { RankingEntry } from "@/types"
import { useAuthStore, useCoalitionStore } from "@/hooks"
import { useSearchParams } from "next/navigation"
import { Info } from 'lucide-react'

type SortField = 'rank' | 'coalition' | 'login' | 'intraLevel' | 'coalitionPoints'
type SortDirection = 'asc' | 'desc'

const sortOptions: Array<{ value: SortField; label: string }> = [
	{ value: 'rank', label: 'Posicion' },
	{ value: 'coalitionPoints', label: 'Puntos' },
	{ value: 'intraLevel', label: 'Nivel' },
	{ value: 'login', label: 'Login' },
	{ value: 'coalition', label: 'Coalicion' },
]

const levelUpperBound = 21

export const LeaderboardUsers = ({ ranking }: { ranking: RankingEntry[] }) => {
	const { coalitions } = useCoalitionStore()
	const { user } = useAuthStore()
	const searchParams = useSearchParams()
	const [search, setSearch] = useState('')
	const [selectedCoalitions, setSelectedCoalitions] = useState<string[]>([])
	const [levelMin, setLevelMin] = useState(0)
	const [levelMax, setLevelMax] = useState(levelUpperBound)
	const [sortBy, setSortBy] = useState<SortField>('rank')
	const [sortDir, setSortDir] = useState<SortDirection>('asc')
	const [page, setPage] = useState(1)
	const [perPage, setPerPage] = useState(25)

	const coalitionBySlug = useMemo(
		() => new Map(coalitions.map((coalition) => [coalition.slug, coalition])),
		[coalitions]
	)

	useEffect(() => {
		const coalitionFromQuery = searchParams.get('coalition')
		if (coalitionFromQuery) {
			const coalitionExists = coalitions.some((coalition) => coalition.slug === coalitionFromQuery)
			if (coalitionExists) {
				setSelectedCoalitions([coalitionFromQuery])
			}
		}

		const minFromQuery = Number.parseInt(searchParams.get('levelMin') ?? '', 10)
		const maxFromQuery = Number.parseInt(searchParams.get('levelMax') ?? '', 10)
		const safeMin = Number.isNaN(minFromQuery)
			? 0
			: Math.max(0, Math.min(minFromQuery, levelUpperBound))
		const safeMax = Number.isNaN(maxFromQuery)
			? levelUpperBound
			: Math.max(0, Math.min(maxFromQuery, levelUpperBound))

		setLevelMin(Math.min(safeMin, safeMax))
		setLevelMax(Math.max(safeMin, safeMax))
		setPage(1)
	}, [coalitions, searchParams])

	if (!ranking || ranking.length === 0) {
		return <div className="text-text-secondary mt-6">No hay usuarios para mostrar.</div>
	}

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
		setSortBy('rank')
		setSortDir('asc')
		setPage(1)
	}

	const filtered = ranking.filter((user) => {
		const passSearch =
			search.trim().length === 0 ||
			user.login.toLowerCase().includes(search.toLowerCase()) ||
			user.displayName.toLowerCase().includes(search.toLowerCase())

		const passCoalition =
			selectedCoalitions.length === 0 || selectedCoalitions.includes(user.coalition)

		const passLevel = user.intraLevel >= levelMin && user.intraLevel <= levelMax

		return passSearch && passCoalition && passLevel
	})

	const sorted = [...filtered].sort((a, b) => {
		const valueA = a[sortBy]
		const valueB = b[sortBy]

		if (typeof valueA === 'string' && typeof valueB === 'string') {
			return sortDir === 'asc'
				? valueA.localeCompare(valueB)
				: valueB.localeCompare(valueA)
		}

		return sortDir === 'asc'
			? (valueA as number) - (valueB as number)
			: (valueB as number) - (valueA as number)
	})

	const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
	const safePage = Math.min(page, totalPages)
	const pageStartIndex = (safePage - 1) * perPage
	const paginated = sorted.slice(pageStartIndex, pageStartIndex + perPage)

	const usersRangeStart = sorted.length === 0 ? 0 : pageStartIndex + 1
	const usersRangeEnd = Math.min(pageStartIndex + perPage, sorted.length)

	const totalPoints = filtered.reduce((sum, user) => sum + user.coalitionPoints, 0)
	const avgLevel =
		filtered.length > 0
			? filtered.reduce((sum, user) => sum + user.intraLevel, 0) / filtered.length
			: 0

	const userCoalition = coalitions.find((c) => c.slug === user?.coalition)

	return (
		<div className="w-full mx-auto max-w-400 px-4 md:px-6 py-4">
			<div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-extrabold text-text tracking-tight">Clasificacion Global</h1>
					<p className="text-text-secondary mt-1">Temporada actual de coaliciones</p>
				</div>
				<div className="flex gap-2">
					<div className="px-4 py-2 bg-card border border-border rounded-lg flex items-center gap-3">
						<span className="text-xs font-bold text-text-secondary uppercase">Mi Ranking en {user?.coalition}</span>
						<span className="font-mono font-bold" style={{ color: userCoalition?.color }}>#{user?.coalitionUserRank ?? '-'}</span>
					</div>
					<div className="px-4 py-2 bg-card border border-border rounded-lg flex items-center gap-3">
						<span className="text-xs font-bold text-text-secondary uppercase">Mi Ranking en Madrid</span>
						<span className="text-accent font-mono font-bold">#{user?.campusUserRank ?? '-'}</span>
					</div>
				</div>
			</div>

			<div className="flex flex-col lg:flex-row gap-6">
				<aside className="w-full lg:w-72 bg-card border border-border rounded-xl p-5 h-fit sticky top-10 self-start">
					<div className="space-y-7">
						<div>
							<label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
								Busqueda rapida
							</label>
							<input
								className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
								placeholder="Buscar por login o nombre"
								type="text"
								value={search}
								onChange={(event) => {
									setSearch(event.target.value)
									setPage(1)
								}}
							/>
						</div>

						<div>
							<label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
								Coaliciones
							</label>
							<div className="space-y-2 max-h-48 overflow-y-auto pr-1">
								{coalitions.map((coalition) => {
									const checked = selectedCoalitions.includes(coalition.slug)
									return (
										<label key={coalition.slug} className="flex items-center gap-3 cursor-pointer group">
											<input
												className="rounded border-border bg-background text-accent focus:ring-accent/40"
												type="checkbox"
												checked={checked}
												onChange={() => handleCoalitionToggle(coalition.slug)}
											/>
											<span className="text-sm text-text-secondary group-hover:text-text transition-colors">
												{coalition.name}
											</span>
											<span
												className="ml-auto w-2 h-2 rounded-full"
												style={{ backgroundColor: coalition.color }}
											></span>
										</label>
									)
								})}
							</div>
						</div>

						<div>
							<label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
								Rango de nivel
							</label>
							<div className="grid grid-cols-2 gap-2 mb-2">
								<input
									type="number"
									min={0}
									max={levelUpperBound}
									value={levelMin}
									className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
									onChange={(event) => {
										const parsed = Number(event.target.value)
										const nextMin = Number.isNaN(parsed)
											? 0
											: Math.max(0, Math.min(parsed, levelMax))
										setLevelMin(nextMin)
										setPage(1)
									}}
								/>
								<input
									type="number"
									min={0}
									max={levelUpperBound}
									value={levelMax}
									className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
									onChange={(event) => {
										const parsed = Number(event.target.value)
										const nextMax = Number.isNaN(parsed)
											? levelUpperBound
											: Math.min(levelUpperBound, Math.max(parsed, levelMin))
										setLevelMax(nextMax)
										setPage(1)
									}}
								/>
							</div>
							<div className="flex justify-between mt-2 text-[10px] font-mono text-text-secondary">
								<span>Desde LVL {levelMin}</span>
								<span className="text-accent">Hasta LVL {levelMax}</span>
								<span>LVL {levelUpperBound}</span>
							</div>
						</div>

						<div>
							<label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
								Ordenar por
							</label>
							<select
								className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
								value={sortBy}
								onChange={(event) => {
									setSortBy(event.target.value as SortField)
									setPage(1)
								}}
							>
								{sortOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>

						<div className="flex gap-2">
							<button
								onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
								className="w-full bg-card-hover border border-border text-text py-2 rounded-lg text-sm font-semibold hover:border-accent/50 transition-colors"
							>
								Direccion: {sortDir === 'asc' ? 'Asc' : 'Desc'}
							</button>
							<button
								onClick={clearFilters}
								className="w-full bg-accent/10 border border-accent/20 text-accent py-2 rounded-lg text-sm font-semibold hover:bg-accent/20 transition-all"
							>
								Limpiar
							</button>
						</div>
					</div>
				</aside>

				<section className="flex-1">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
						<div className="bg-card p-4 rounded-xl border border-border relative overflow-hidden">
							<span className="text-[10px] font-bold text-text-secondary uppercase">Total Usuarios</span>
							<div className="text-2xl font-black text-text">{filtered.length.toLocaleString('es-ES')}</div>
						</div>
						<div className="bg-card p-4 rounded-xl border border-border relative overflow-hidden">
							<span className="text-[10px] font-bold text-text-secondary uppercase">Puntos Totales</span>
							<div className="text-2xl font-black text-accent">{Math.round(totalPoints).toLocaleString('es-ES')}</div>
						</div>
						<div className="bg-card p-4 rounded-xl border border-border relative overflow-hidden">
							<span className="text-[10px] font-bold text-text-secondary uppercase">Nivel Promedio</span>
							<div className="text-2xl font-black text-text">{avgLevel.toFixed(2)}</div>
						</div>
					</div>

					<div className="bg-card rounded-xl border border-border overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full text-left border-collapse min-w-205">
								<thead>
									<tr className="bg-background text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border">
										<th className="px-6 py-4">
											<div className="relative inline-flex items-center gap-1 group">
												<span>Ranking (M/C)</span>
												<Info size={12} color="var(--color-accent)" />
												<span
													role="tooltip"
													className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-md border border-border bg-card p-2 text-[11px] normal-case tracking-normal text-text-secondary opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
												>
													M = Ranking Madrid | C = Ranking dentro de su coalicion
												</span>
											</div>
										</th>
										<th className="px-6 py-4">Usuario</th>
										<th className="px-6 py-4">Coalicion</th>
										<th className="px-6 py-4 text-center">Nivel</th>
										<th className="px-6 py-4 text-right">Puntos</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border text-sm">
									{paginated.map((user) => {
										const coalition = coalitionBySlug.get(user.coalition)
										return (
											<tr key={user.login} className="hover:bg-card-hover/70 transition-colors group">
												<td className="px-6 py-4 font-mono font-regular"><span className="text-accent">{String(user.rank).padStart(2, '0')}</span> | <span style={{ color: coalition?.color || 'var(--color-text-secondary)' }}>{String(user.coalitionRank).padStart(2, '0')}</span></td>
												<td className="px-6 py-4">
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 rounded-full bg-background shrink-0 overflow-hidden border border-border">
															<img
																src={user.avatar}
																alt={user.displayName || user.login}
																className="w-full h-full object-cover"
															/>
														</div>
														<a
															href={`https://profile.intra.42.fr/users/${user.login}`}
															target="_blank"
															rel="noreferrer"
															className="font-semibold text-text group-hover:text-accent transition-colors"
														>
															{user.login}
														</a>
													</div>
												</td>
												<td className="px-6 py-4">
													<span
														className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border"
														style={{
															color: coalition?.color || 'var(--color-text-secondary)',
															borderColor: coalition?.color || 'var(--color-border)',
															backgroundColor: coalition?.color ? `${coalition.color}1a` : 'var(--color-card)',
														}}
													>
														<span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: coalition?.color || '#94a3b8' }}></span>
														{coalition?.name || user.coalition}
													</span>
												</td>
												<td className="px-6 py-4 text-center font-mono">{user.intraLevel.toFixed(2)}</td>
												<td className="px-6 py-4 text-right font-mono font-medium text-text">
													{user.coalitionPoints.toLocaleString('es-ES')}
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</div>

						<div className="bg-background/50 px-6 py-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
							<span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest">
								Mostrando {usersRangeStart}-{usersRangeEnd} de {sorted.length} usuarios
							</span>
							<div className="flex items-center gap-2">
								<select
									value={perPage}
									onChange={(event) => {
										setPerPage(Number(event.target.value))
										setPage(1)
									}}
									className="bg-card border border-border rounded-md px-2 py-1 text-xs"
								>
									{[10, 25, 50, 100].map((size) => (
										<option key={size} value={size}>
											{size} / pagina
										</option>
									))}
								</select>
								<button
									disabled={safePage === 1}
									onClick={() => setPage((current) => Math.max(1, current - 1))}
									className="px-3 py-1 text-xs font-bold rounded-md hover:bg-card-hover text-text-secondary disabled:opacity-50"
								>
									Anterior
								</button>
								<span className="text-xs font-bold text-text-secondary">{safePage}/{totalPages}</span>
								<button
									disabled={safePage === totalPages}
									onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
									className="px-3 py-1 text-xs font-bold rounded-md hover:bg-card-hover text-text-secondary disabled:opacity-50"
								>
									Siguiente
								</button>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	)
}