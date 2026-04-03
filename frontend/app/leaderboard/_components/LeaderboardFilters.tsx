'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import type { Coalition } from '@/types'
import type { LeaderboardFilterPreset } from './leaderboardFilterPresets'

interface LeaderboardFiltersProps {
	coalitions: Coalition[]
	levelMax: number
	levelMin: number
	levelUpperBound: number
	maxPointsLvl: number
	pointsMax: number
	pointsMin: number
	activePresetId: string | null
	editingPresetId: string | null
	editingPresetName: string
	formatLeaderboardNumber: (value: number) => string
	hasAppliedFilters: boolean
	showCreatePresetButton: boolean
	showUpdatePresetButton: boolean
	onTogglePreset: (preset: LeaderboardFilterPreset) => void
	onCreatePreset: () => void
	onDeletePreset: (presetId: string) => void
	onStartEditPreset: (presetId: string) => void
	onUpdatePreset: (presetId: string) => void
	onEditingPresetNameChange: (value: string) => void
	onClearFilters: () => void
	onLevelMaxChange: (value: number) => void
	onLevelMinChange: (value: number) => void
	onPointsMaxChange: (value: number) => void
	onPointsMinChange: (value: number) => void
	onSearchChange: (value: string) => void
	onToggleCoalition: (slug: string) => void
	savedFilterPresets: LeaderboardFilterPreset[]
	search: string
	selectedCoalitions: string[]
}

export const LeaderboardFilters = ({
	coalitions,
	levelMax,
	levelMin,
	levelUpperBound,
	maxPointsLvl,
	pointsMin,
	pointsMax,
	activePresetId,
	editingPresetId,
	editingPresetName,
	formatLeaderboardNumber,
	hasAppliedFilters,
	showCreatePresetButton,
	showUpdatePresetButton,
	onTogglePreset,
	onCreatePreset,
	onDeletePreset,
	onStartEditPreset,
	onUpdatePreset,
	onEditingPresetNameChange,
	onClearFilters,
	onLevelMaxChange,
	onLevelMinChange,
	onPointsMaxChange,
	onPointsMinChange,
	onSearchChange,
	onToggleCoalition,
	savedFilterPresets,
	search,
	selectedCoalitions,
}: LeaderboardFiltersProps) => {
	const [isSavedFiltersOpen, setIsSavedFiltersOpen] = useState(false)
	const minPercentLvl = (levelMin / levelUpperBound) * 100
	const maxPercentLvl = (levelMax / levelUpperBound) * 100

	const safeMaxPointsLvl = Math.max(maxPointsLvl, 1)
	const minPercentPts = (pointsMin / safeMaxPointsLvl) * 100
	const maxPercentPts = (pointsMax / safeMaxPointsLvl) * 100

	return (
		<aside className="w-full lg:w-72 bg-card border border-border rounded-xl p-5 h-fit lg:sticky top-10 self-start">

			<div className="space-y-7">
				<div>
					<button
						type="button"
						onClick={() => setIsSavedFiltersOpen((current) => !current)}
						className="w-full flex items-center justify-between gap-3"
					>
						<span className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest">
							Filtros guardados (demo)
						</span>
						{isSavedFiltersOpen ? (
							<ChevronUp size={14} className="text-text-secondary" />
						) : (
							<ChevronDown size={14} className="text-text-secondary" />
						)}
					</button>
					{isSavedFiltersOpen && (
						<div className="mt-2 space-y-2">
							{savedFilterPresets.map((preset) => {
								const isActive = activePresetId === preset.id
								const isEditing = editingPresetId === preset.id
								return (
									<div
										key={preset.id}
										className={`w-full rounded-lg border px-3 py-2 ${isActive ? 'border-accent/40 bg-accent/5' : 'border-border bg-background'}`}
									>
										<div className="flex items-center justify-between gap-2">
											{isEditing ? (
												<div className="min-w-0 text-left flex-1">
													<input
														type="text"
														value={editingPresetName}
														onChange={(event) => onEditingPresetNameChange(event.target.value)}
														onKeyDown={(event) => {
															if (event.key === 'Enter') {
																event.preventDefault()
																onUpdatePreset(preset.id)
															}
														}}
														className="w-full bg-background border border-border rounded px-2 py-1 text-xs font-semibold text-text"
													/>
													<span className="text-[10px] font-bold uppercase tracking-wider text-accent">Editando</span>
												</div>
											) : (
												<button
													type="button"
													onClick={() => onTogglePreset(preset)}
													className="min-w-0 text-left flex-1"
												>
													<span className="text-xs font-semibold text-text truncate block">{preset.name}</span>
												</button>
											)}
											<div className="flex items-center gap-2">
												<button
													type="button"
													onClick={(event) => {
														event.stopPropagation()
														onStartEditPreset(preset.id)
													}}
													className="text-text-secondary hover:text-text transition-colors"
													aria-label={`Editar ${preset.name}`}
												>
													<Pencil size={14} />
												</button>
												<button
													type="button"
													onClick={(event) => {
														event.stopPropagation()
														onDeletePreset(preset.id)
													}}
													className="text-red-500 hover:text-red-400 transition-colors"
													aria-label={`Eliminar ${preset.name}`}
												>
													<Trash2 size={14} />
												</button>
											</div>
										</div>
									</div>
								)
							})}
						</div>
					)}
				</div>
				<div>
					<label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
						Busqueda rapida
					</label>
					<input
						className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
						placeholder="Buscar por login o nombre"
						type="text"
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
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
										onChange={() => onToggleCoalition(coalition.slug)}
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
					<div className="level-range relative mt-3 h-10 mb-2">
						<div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border"></div>
						<div
							className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent/80"
							style={{ left: `${minPercentLvl}%`, right: `${100 - maxPercentLvl}%` }}
						></div>
						<input
							type="range"
							min={0}
							max={levelUpperBound}
							step={1}
							value={levelMin}
							className="level-range-input level-range-input-min"
							aria-label="Nivel minimo"
							onChange={(event) => {
								const parsed = Number(event.target.value)
								const nextMin = Number.isNaN(parsed)
									? 0
									: Math.max(0, Math.min(parsed, levelMax))
								onLevelMinChange(nextMin)
							}}
						/>
						<input
							type="range"
							min={0}
							max={levelUpperBound}
							step={1}
							value={levelMax}
							className="level-range-input level-range-input-max"
							aria-label="Nivel maximo"
							onChange={(event) => {
								const parsed = Number(event.target.value)
								const nextMax = Number.isNaN(parsed)
									? levelUpperBound
									: Math.min(levelUpperBound, Math.max(parsed, levelMin))
								onLevelMaxChange(nextMax)
							}}
						/>
					</div>
					<div className="flex justify-between mt-2 text-[10px] font-mono text-text-secondary">
						<span>LVL {levelMin}</span>
						<span className="text-accent">Hasta LVL {levelMax}</span>
						<span>LVL {levelUpperBound}</span>
					</div>
				</div>				<div>
					<label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
						Rango de puntos de coalicion
					</label>
					<div className="level-range relative mt-3 h-10 mb-2">
						<div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border"></div>
						<div
							className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent/80"
							style={{ left: `${minPercentPts}%`, right: `${100 - maxPercentPts}%` }}
						></div>
						<input
							type="range"
							min={0}
							max={maxPointsLvl}
							step={1}
							value={pointsMin}
							className="level-range-input level-range-input-min"
							aria-label="Puntos minimos"
							onChange={(event) => {
								const parsed = Number(event.target.value)
								const nextMin = Number.isNaN(parsed)
									? 0
									: Math.max(0, Math.min(parsed, pointsMax))
								onPointsMinChange(nextMin)
							}}
						/>
						<input
							type="range"
							min={0}
							max={maxPointsLvl}
							step={1}
							value={pointsMax}
							className="level-range-input level-range-input-max"
							aria-label="Puntos maximos"
							onChange={(event) => {
								const parsed = Number(event.target.value)
								const nextMax = Number.isNaN(parsed)
									? maxPointsLvl
									: Math.min(maxPointsLvl, Math.max(parsed, pointsMin))
								onPointsMaxChange(nextMax)
							}}
						/>
					</div>
					<div className="flex justify-between mt-2 text-[10px] font-mono text-text-secondary">
						<span>{formatLeaderboardNumber(pointsMin)} puntos</span>
						<span className="text-accent">Hasta {formatLeaderboardNumber(pointsMax)} puntos</span>
						<span>{formatLeaderboardNumber(maxPointsLvl)} puntos</span>
					</div>
				</div>

				<div className="flex flex-col gap-4">
					<button
						type="button"
						onClick={onClearFilters}
						disabled={!hasAppliedFilters}
						className={`w-full py-2 rounded-lg text-sm font-semibold border transition-all ${hasAppliedFilters ? 'cursor-pointer bg-accent/10 border-accent/20 text-accent hover:bg-accent/20' : 'cursor-not-allowed bg-card border-border text-text-secondary opacity-60'}`}
					>
						Limpiar filtros
					</button>
					{editingPresetId && showUpdatePresetButton && (
						<button
							type="button"
							onClick={() => onUpdatePreset(editingPresetId)}
							className="cursor-pointer w-full bg-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-all"
						>
							Confirmar guardado del filtro
						</button>
					)}
					{showCreatePresetButton && (
						<button
							type="button"
							onClick={onCreatePreset}
							className="cursor-pointer w-full bg-card border border-border py-2 rounded-lg text-sm font-semibold transition-all text-text hover:bg-card-hover"
						>
							Guardar filtro personalizado
						</button>
					)}
				</div>
			</div>
		</aside>
	)
}