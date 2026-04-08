import { Medal, Rocket, Shield, Swords } from 'lucide-react'
import type { Achievement } from './types'

const iconByAchievement = {
	medal: Medal,
	rocket: Rocket,
	shield: Shield,
	swords: Swords,
} as const

type UserAchievementsProps = {
	achievements: Achievement[]
}

export function UserAchievements({ achievements }: UserAchievementsProps) {
	return (
		<div className="rounded-3xl border border-border bg-card p-6">
			<div className="mb-6 flex items-center justify-between">
				<h2 className="text-xl font-black">Logros</h2>
				<span className="text-xs font-semibold uppercase tracking-[0.18em] text-(--coalition-color)">
					{achievements.filter((achievement) => achievement.completed).length}/{achievements.length}
				</span>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				{achievements.map((achievement) => {
					const Icon = iconByAchievement[achievement.icon]
					const statusLabel = achievement.completed ? 'Completado' : 'En progreso'
					return (
						<article
							key={achievement.title}
							className={`flex flex-col justify-between group rounded-2xl border p-4 ${achievement.completed ? 'border-(--coalition-color)/40 bg-(--coalition-color)/8' : 'border-border bg-surface/50'}`}
						>
							<div className="flex items-center justify-between gap-4 mb-3">
								<div className="inline-flex rounded-lg border border-border bg-card p-2">
									<Icon className="h-5 w-5 text-(--coalition-color)" />
								</div>
								<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${achievement.completed ? 'bg-(--coalition-color)/20 text-text' : 'bg-card text-text-secondary'}`}>
									{statusLabel}
								</span>
							</div>
							<div className="flex items-start justify-between gap-3">
								<h3 className="text-sm font-bold">{achievement.title}</h3>
							</div>
							<p className="mt-1 text-xs text-text-secondary">{achievement.description}</p>
							<div className="mt-4 h-1.5 overflow-hidden rounded-full bg-card">
								<div className="h-full bg-(--coalition-color)" style={{ width: `${achievement.progress}%` }} />
							</div>
							<div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-text-secondary">
								<span>{achievement.progress}%</span>
								<span>{achievement.completionDate ? `Fecha: ${achievement.completionDate}` : ''}</span>
							</div>
						</article>
					)
				})}
			</div>
		</div>
	)
}
