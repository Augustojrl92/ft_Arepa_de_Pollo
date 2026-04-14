
import { Info } from 'lucide-react'

type SortField =
	| 'rank'
	| 'coalition'
	| 'login'
	| 'intraLevel'
	| 'coalitionPoints'
	| 'evaluationsDoneCurrentSeason'
	| 'evaluationsDoneTotal'
type SortDirection = 'asc' | 'desc'

const levelUpperBound = 25

export const LeaderboardUsers = () => {
	const { coalitions, ranking, rankingMeta, isRankingLoading, getRanking } = useCoalitionStore()
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
	const [isRankInfoOpen, setIsRankInfoOpen] = useState(false)
	const rankInfoRef = useRef<HTMLDivElement | null>(null)
	const rankingView = searchParams.get('view') ?? 'coalition-points'
	const isCorrectionsView = rankingView === 'corrections'

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

	const serverCoalitionFilter = selectedCoalitions.length === 1 ? selectedCoalitions[0] : undefined

	useEffect(() => {
		void getRanking({
			coalition: serverCoalitionFilter,
		})
	}, [getRanking, serverCoalitionFilter])

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
		if (!isCorrectionsView && (sortBy === 'evaluationsDoneCurrentSeason' || sortBy === 'evaluationsDoneTotal')) {
			setSortBy('rank')
			setSortDir('asc')
		}
	}, [isCorrectionsView, sortBy])

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

	const handleSort = (field: SortField) => {
		setPage(1)
		if (sortBy === field) {
			setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
			return
		}
		setSortBy(field)
		setSortDir('asc')
	}

	const coalitionFiltered = ranking.filter((user) => {
		const passSearch =
			search.trim().length === 0 ||
			user.login.toLowerCase().includes(search.toLowerCase()) ||
			user.displayName.toLowerCase().includes(search.toLowerCase())

		const passCoalition =
			selectedCoalitions.length === 0 || selectedCoalitions.includes(user.coalition)

		const passLevel = user.intraLevel >= levelMin && user.intraLevel <= levelMax

		return passSearch && passCoalition && passLevel
	})

	const coalitionViewSorted = [...coalitionFiltered].sort((a, b) => {
		const valueA = a[sortBy as 'rank' | 'coalition' | 'login' | 'intraLevel' | 'coalitionPoints']
		const valueB = b[sortBy as 'rank' | 'coalition' | 'login' | 'intraLevel' | 'coalitionPoints']

		if (typeof valueA === 'string' && typeof valueB === 'string') {
			return sortDir === 'asc'
				? valueA.localeCompare(valueB)
				: valueB.localeCompare(valueA)
		}

		return sortDir === 'asc'
			? (valueA as number) - (valueB as number)
			: (valueB as number) - (valueA as number)
	})

	const rankingWithCorrectionRanks = useMemo(() => {
		const sortedByCorrections = [...ranking].sort((a, b) => {
			if (b.evaluationsDoneCurrentSeason !== a.evaluationsDoneCurrentSeason) {
				return b.evaluationsDoneCurrentSeason - a.evaluationsDoneCurrentSeason
			}
			if (b.evaluationsDoneTotal !== a.evaluationsDoneTotal) {
				return b.evaluationsDoneTotal - a.evaluationsDoneTotal
			}
			return a.login.localeCompare(b.login)
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

	const correctionsFiltered = rankingWithCorrectionRanks.filter((user) => {
		const passSearch =
			search.trim().length === 0 ||
			user.login.toLowerCase().includes(search.toLowerCase()) ||
			user.displayName.toLowerCase().includes(search.toLowerCase())

		const passCoalition =
			selectedCoalitions.length === 0 || selectedCoalitions.includes(user.coalition)

		const passLevel = user.intraLevel >= levelMin && user.intraLevel <= levelMax

		return passSearch && passCoalition && passLevel
	})

	const correctionsSorted = [...correctionsFiltered].sort((a, b) => {
		const valueA = sortBy === 'rank' ? a.correctionRank : a[sortBy]
		const valueB = sortBy === 'rank' ? b.correctionRank : b[sortBy]

		if (typeof valueA === 'string' && typeof valueB === 'string') {
			return sortDir === 'asc'
				? valueA.localeCompare(valueB)
				: valueB.localeCompare(valueA)
		}

		return sortDir === 'asc'
			? (valueA as number) - (valueB as number)
			: (valueB as number) - (valueA as number)
	})

	const displayedUsers = isCorrectionsView ? correctionsSorted : coalitionViewSorted

	const localTotalPages = Math.max(Math.ceil(displayedUsers.length / perPage), 1)
	const safePage = Math.min(page, localTotalPages)
	const paginated = displayedUsers.slice((safePage - 1) * perPage, safePage * perPage)
	const hasLocalFilters =
		search.trim().length > 0 ||
		selectedCoalitions.length > 1 ||
		levelMin > 0 ||
		levelMax < levelUpperBound
	const usersRangeStart = displayedUsers.length === 0 ? 0 : ((safePage - 1) * perPage) + 1
	const usersRangeEnd = displayedUsers.length === 0 ? 0 : Math.min(safePage * perPage, displayedUsers.length)

	const totalPoints = displayedUsers.reduce((sum, user) => sum + user.coalitionPoints, 0)
	const totalCurrentSeasonCorrections = displayedUsers.reduce((sum, user) => sum + user.evaluationsDoneCurrentSeason, 0)
	const totalLifetimeCorrections = displayedUsers.reduce((sum, user) => sum + user.evaluationsDoneTotal, 0)
	const avgLevel =
		displayedUsers.length > 0
			? displayedUsers.reduce((sum, user) => sum + user.intraLevel, 0) / displayedUsers.length
			: 0

	const currentUserCorrectionEntry = rankingWithCorrectionRanks.find((entry) => entry.login === user?.login)

	useEffect(() => {
		if (page > localTotalPages) {
			setPage(localTotalPages)
		}
	}, [localTotalPages, page])

	// Mostrar skeleton mientras se cargan los datos iniciales
	if (isRankingLoading && ranking.length === 0) {
		return (
			<div className="w-full mx-auto max-w-400 px-4 md:px-6 py-4">
				<div className="animate-pulse space-y-6">
					<div className="h-10 bg-surface-elevated rounded w-1/3"></div>
					<div className="h-32 bg-surface-elevated rounded"></div>
					<div className="h-96 bg-surface-elevated rounded"></div>
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
					<h1 className="text-3xl font-extrabold text-text tracking-tight">Clasificacion Global</h1>
					<p className="text-text-secondary mt-1">Temporada actual de coaliciones</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Link
						href="/leaderboard?view=coalition-points"
						className={`px-4 py-2 bg-card border rounded-lg flex items-center gap-3 transition-colors ${
							rankingView === 'coalition-points'
								? 'border-accent bg-accent/14 text-accent shadow-[0_0_0_1px_rgba(255,255,255,0.04)]'
								: 'border-border text-text-secondary hover:text-text hover:bg-card-hover/70'
						}`}
					>
						<span className="text-xs font-bold uppercase">Puntos de coaliciones</span>
					</Link>
					<Link
						href="/leaderboard?view=corrections"
						className={`px-4 py-2 bg-card border rounded-lg flex items-center gap-3 transition-colors ${
							rankingView === 'corrections'
								? 'border-accent bg-accent/14 text-accent shadow-[0_0_0_1px_rgba(255,255,255,0.04)]'
								: 'border-border text-text-secondary hover:text-text hover:bg-card-hover/70'
						}`}
					>
						<span className="text-xs font-bold uppercase">Numero de correcciones</span>
					</Link>
					<div className="px-4 py-2 bg-card border border-border rounded-lg flex items-center gap-3">
						<span className="text-xs font-bold text-text-secondary uppercase">
							{isCorrectionsView ? 'Mi Ranking en correcciones' : `Mi Ranking en ${user?.coalition}`}
						</span>
						<span className="font-mono font-bold" style={{ color: userCoalition?.color }}>
							#{isCorrectionsView ? (currentUserCorrectionEntry?.correctionCoalitionRank ?? '-') : (user?.coalitionUserRank ?? '-')}
						</span>
					</div>
					<div className="px-4 py-2 bg-card border border-border rounded-lg flex items-center gap-3">
						<span className="text-xs font-bold text-text-secondary uppercase">
							{isCorrectionsView ? 'Mi Ranking en Madrid' : 'Mi Ranking en Madrid'}
						</span>
						<span className="text-accent font-mono font-bold">
							{isCorrectionsView
								? `#${currentUserCorrectionEntry?.correctionRank ?? '-'}`
								: `#${user?.campusUserRank ?? '-'}`}
						</span>
					</div>
				</div>
			</div>

			<div className="flex flex-col lg:flex-row gap-6">
				<LeaderboardFilters
					coalitions={coalitions}
					levelMax={levelMax}
					levelMin={levelMin}
					levelUpperBound={levelUpperBound}
					minPointsLvl={minPointsLvl}
					maxPointsLvl={maxPointsLvl}
					pointsMax={pointsMax}
					pointsMin={pointsMin}
					activePresetId={activePresetId}
					onTogglePreset={togglePreset}
					onCreatePreset={createPresetFromCurrentFilters}
					onDeletePreset={deletePreset}
					onStartEditPreset={startEditPreset}
					onUpdatePreset={updatePresetFromCurrentFilters}
					onEditingPresetNameChange={setEditingPresetName}
					onClearFilters={clearFilters}
					onLevelMaxChange={handleLevelMaxChange}
					onLevelMinChange={handleLevelMinChange}
					onPointsMaxChange={handlePointsMaxChange}
					onPointsMinChange={handlePointsMinChange}
					onSearchChange={handleSearchChange}
					onToggleCoalition={handleCoalitionToggle}
					savedFilterPresets={savedFilterPresets}
					editingPresetId={editingPresetId}
					editingPresetName={editingPresetName}
					formatLeaderboardNumber={formatLeaderboardNumber}
					hasAppliedFilters={hasAppliedFilters}
					showCreatePresetButton={showCreatePresetButton}
					showUpdatePresetButton={showUpdatePresetButton}
					search={search}
					selectedCoalitions={selectedCoalitions}
				/>

				<section className="flex-1">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
						<div className="bg-card p-4 rounded-xl border border-border relative overflow-hidden">
							<span className="text-[10px] font-bold text-text-secondary uppercase">Total Usuarios</span>
							<div className="text-2xl font-black text-text">{displayedUsers.length.toLocaleString('es-ES')}</div>
						</div>
						<div className="bg-card p-4 rounded-xl border border-border relative overflow-hidden">
							<span className="text-[10px] font-bold text-text-secondary uppercase">
								{isCorrectionsView ? 'Correcciones temporada' : 'Puntos Totales'}
							</span>
							<div className="text-2xl font-black text-accent">
								{isCorrectionsView
									? totalCurrentSeasonCorrections.toLocaleString('es-ES')
									: Math.round(totalPoints).toLocaleString('es-ES')}
							</div>
						</div>
						<div className="bg-card p-4 rounded-xl border border-border relative overflow-hidden">
							<span className="text-[10px] font-bold text-text-secondary uppercase">
								{isCorrectionsView ? 'Correcciones totales' : 'Nivel Promedio'}
							</span>
							<div className="text-2xl font-black text-text">
								{isCorrectionsView
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
													<span>{isCorrectionsView ? 'Ranking Correcciones (M/C)' : 'Ranking (M/C)'}</span>
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
										{isCorrectionsView ? (
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
								{paginated.map((user) => {
										const coalition = coalitionBySlug.get(user.coalition)
										return (
											<tr key={user.login} className="hover:bg-card-hover/70 transition-colors group">
												<td className="px-6 py-4 font-mono font-regular"><span className="text-accent">{String(isCorrectionsView ? user.correctionRank : user.rank).padStart(2, '0')}</span> | <span style={{ color: coalition?.color || 'var(--color-text-secondary)' }}>{String(isCorrectionsView ? user.correctionCoalitionRank : user.coalitionRank).padStart(2, '0')}</span></td>
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
													<Link
														href={`/coalitions/${coalition?.slug || user.coalition}`}
														className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border"
														style={{
															color: coalition?.color || 'var(--color-text-secondary)',
															borderColor: coalition?.color || 'var(--color-border)',
															backgroundColor: coalition?.color ? `${coalition.color}1a` : 'var(--color-card)',
														}}
													>
														<span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: coalition?.color || '#94a3b8' }}></span>
														{coalition?.name || user.coalition}
													</Link>
												</td>
												<td className="px-6 py-4 text-center font-mono">{user.intraLevel.toFixed(2)}</td>
												<td className="px-6 py-4 text-right font-mono font-medium text-text">
													{isCorrectionsView
														? `${user.evaluationsDoneCurrentSeason.toLocaleString('es-ES')} | ${user.evaluationsDoneTotal.toLocaleString('es-ES')}`
														: user.coalitionPoints.toLocaleString('es-ES')}
												</td>
											</tr>
										)
									})}
									{paginated.length === 0 && (
										<tr>
											<td colSpan={5} className="px-6 py-4 text-center text-text">
												No hay usuarios que coincidan con los filtros aplicados.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>

						<div className="bg-background/50 px-6 py-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
							<span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest">
								{hasLocalFilters
									? `Mostrando ${usersRangeStart}-${usersRangeEnd} de ${displayedUsers.length} usuarios filtrados`
									: `Mostrando ${usersRangeStart}-${usersRangeEnd} de ${rankingMeta.total} usuarios`}
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
								<span className="text-xs font-bold text-text-secondary">{safePage}/{localTotalPages}</span>
								<button
									disabled={safePage >= localTotalPages}
									onClick={() => setPage((current) => Math.min(localTotalPages, current + 1))}
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
