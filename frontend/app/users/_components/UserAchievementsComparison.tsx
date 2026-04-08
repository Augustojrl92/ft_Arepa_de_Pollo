'use client'

import { Trophy, Sparkles, ShieldCheck, CircleSlash2 } from 'lucide-react'
import type { Achievement } from '@/types'

type AchievementComparisonProps = {
	currentAchievements: Achievement[]
	friendLogin: string
	friendDisplayName: string
	friendAchievements: Achievement[] | null | undefined
}

const normalizeAchievements = (achievements: Achievement[]) =>
	new Map(achievements.map((achievement) => [achievement.slug || achievement.title.toLowerCase(), achievement]))

export function UserAchievementsComparison({
	currentAchievements,
	friendLogin,
	friendDisplayName,
	friendAchievements,
}: AchievementComparisonProps) {
	const currentMap = normalizeAchievements(currentAchievements)
	const friendMap = friendAchievements ? normalizeAchievements(friendAchievements) : null

	const currentCompleted = currentAchievements.filter((achievement) => achievement.completed || achievement.status === 'completed')
	const friendCompleted = friendAchievements?.filter((achievement) => achievement.completed || achievement.status === 'completed') ?? []

	const sharedCompleted = friendMap
		? currentCompleted.filter((achievement) => friendMap.has(achievement.slug || achievement.title.toLowerCase()))
		: []

	const onlyMine = friendMap
		? currentCompleted.filter((achievement) => !friendMap.has(achievement.slug || achievement.title.toLowerCase()))
		: []

	const onlyFriend = friendMap
		? friendCompleted.filter((achievement) => !currentMap.has(achievement.slug || achievement.title.toLowerCase()))
		: []

	return (
		<div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
			<div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-xl font-black">Comparativa de logros</h2>
					<p className="mt-1 text-sm text-text-secondary">
						Comparando tu progreso con {friendDisplayName} (@{friendLogin})
					</p>
				</div>
				<div className="inline-flex rounded-full border border-border bg-surface/50 px-3 py-1 text-xs font-semibold text-text-secondary">
					Solo visible entre amigos
				</div>
			</div>

			{!friendMap ? (
				<div className="rounded-2xl border border-dashed border-border bg-surface/40 p-5">
					<div className="flex items-start gap-3">
						<CircleSlash2 className="mt-0.5 h-5 w-5 text-text-secondary" />
						<div>
							<p className="font-semibold">Aún no hay logros del amigo disponibles</p>
							<p className="mt-1 text-sm text-text-secondary">
								El frontend ya está preparado para comparar logros cuando el backend incluya ese bloque en el detalle del perfil.
							</p>
						</div>
					</div>
				</div>
			) : (
				<>
					<div className="grid gap-4 md:grid-cols-3">
						<div className="rounded-2xl border border-border bg-surface/50 p-4">
							<div className="mb-3 flex items-center gap-2 text-text-secondary">
								<Trophy className="h-4 w-4" />
								<span className="text-xs font-semibold uppercase tracking-[0.16em]">Resumen</span>
							</div>
							<p className="text-3xl font-black">{currentCompleted.length}</p>
							<p className="mt-1 text-sm text-text-secondary">Tus logros completados</p>
						</div>
						<div className="rounded-2xl border border-border bg-surface/50 p-4">
							<div className="mb-3 flex items-center gap-2 text-text-secondary">
								<Sparkles className="h-4 w-4" />
								<span className="text-xs font-semibold uppercase tracking-[0.16em]">Compartidos</span>
							</div>
							<p className="text-3xl font-black">{sharedCompleted.length}</p>
							<p className="mt-1 text-sm text-text-secondary">Logros que ambos tenéis</p>
						</div>
						<div className="rounded-2xl border border-border bg-surface/50 p-4">
							<div className="mb-3 flex items-center gap-2 text-text-secondary">
								<ShieldCheck className="h-4 w-4" />
								<span className="text-xs font-semibold uppercase tracking-[0.16em]">Diferencia</span>
							</div>
							<p className="text-3xl font-black">{Math.abs(currentCompleted.length - friendCompleted.length)}</p>
							<p className="mt-1 text-sm text-text-secondary">Ventaja entre perfiles</p>
						</div>
					</div>

					<div className="mt-6 grid gap-4 xl:grid-cols-2">
						<div className="rounded-2xl border border-border bg-surface/40 p-4">
							<h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-secondary">Solo tú</h3>
							{onlyMine.length > 0 ? (
								<ul className="mt-3 space-y-2">
									{onlyMine.map((achievement) => (
										<li key={achievement.slug} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
											{achievement.title}
										</li>
									))}
								</ul>
							) : (
								<p className="mt-3 text-sm text-text-secondary">No tienes logros únicos frente a este amigo.</p>
							)}
						</div>

						<div className="rounded-2xl border border-border bg-surface/40 p-4">
							<h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-secondary">Solo {friendDisplayName}</h3>
							{onlyFriend.length > 0 ? (
								<ul className="mt-3 space-y-2">
									{onlyFriend.map((achievement) => (
										<li key={achievement.slug} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
											{achievement.title}
										</li>
									))}
								</ul>
							) : (
								<p className="mt-3 text-sm text-text-secondary">No hay diferencias únicas por ahora.</p>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	)
}
