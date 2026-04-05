
import { Info } from 'lucide-react'
import { LeaderboardFilters } from './LeaderboardFilters'
import { LeaderboardPagination } from './LeaderboardPagination'
import { LeaderboardRankingRow } from './LeaderboardRankingRow'
import { useLeaderboard } from '../../../hooks/useLeaderboard'

export const LeaderboardUsers = () => {
	const {
		activePresetId,
		avgLevel,
		clearFilters,
		coalitionBySlug,
		coalitions,
		createPresetFromCurrentFilters,
		deletePreset,
		editingPresetId,
		editingPresetName,
		formatLeaderboardNumber,
		handleCoalitionToggle,
		handleLevelMaxChange,
		handleLevelMinChange,
		handlePerPageChange,
		handlePointsMaxChange,
		handlePointsMinChange,
		handleSearchChange,
		handleSort,
		hasAppliedFilters,
		hasLocalFilters,
		isRankInfoOpen,
		isRankingLoading,
		levelMax,
		levelMin,
		levelUpperBound,
		localTotalPages,
		minPointsLvl,
		maxPointsLvl,
		paginated,
		perPage,
		pointsMax,
		pointsMin,
		rankInfoRef,
		ranking,
		rankingMeta,
		safePage,
		savedFilterPresets,
		search,
		selectedCoalitions,
		setEditingPresetName,
		setIsRankInfoOpen,
		setPage,
		showCreatePresetButton,
		showUpdatePresetButton,
		sortBy,
		sortDir,
		sorted,
		togglePreset,
		totalPoints,
		updatePresetFromCurrentFilters,
		user,
		userCoalition,
		usersRangeEnd,
		usersRangeStart,
		startEditPreset,
	} = useLeaderboard()

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
							<div className="text-2xl font-black text-text">{sorted.length.toLocaleString('es-ES')}</div>
						</div>
						<div className="bg-card p-4 rounded-xl border border-border relative overflow-hidden">
							<span className="text-[10px] font-bold text-text-secondary uppercase">Puntos Totales</span>
							<div className="text-2xl font-black text-accent">{formatLeaderboardNumber(Math.round(totalPoints))}</div>
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
													<span>Ranking (M/C)</span>
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
									</tr>
								</thead>
								<tbody className="divide-y divide-border text-sm">
									{paginated.map((rankingEntry) => (
										<LeaderboardRankingRow
											key={rankingEntry.login}
											coalition={coalitionBySlug.get(rankingEntry.coalition)}
											formattedPoints={formatLeaderboardNumber(Math.round(rankingEntry.coalitionPoints))}
											isCurrentUser={user?.login === rankingEntry.login}
											user={rankingEntry}
										/>
									))}
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

						<LeaderboardPagination
							currentPage={safePage}
							onNext={() => setPage((current) => Math.min(localTotalPages, current + 1))}
							onPerPageChange={handlePerPageChange}
							onPrevious={() => setPage((current) => Math.max(1, current - 1))}
							perPage={perPage}
							summary={hasLocalFilters
								? `Mostrando ${usersRangeStart}-${usersRangeEnd} de ${sorted.length} usuarios filtrados`
								: `Mostrando ${usersRangeStart}-${usersRangeEnd} de ${rankingMeta.total} usuarios`}
							totalPages={localTotalPages}
						/>
					</div>
				</section>
			</div>
		</div>
	)
}
