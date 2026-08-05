import { Medal, Rocket, Shield, Swords } from 'lucide-react'
import type { Achievement } from './types'

type ApiAchievement = {
	name: string
	description: string
	progress: number
	completion_progress: number
	completion_date: string | null
	icon_HTML: string
}

const iconByAchievement = {
	medal: Medal,
	rocket: Rocket,
	shield: Shield,
	swords: Swords,
} as const

type UserAchievementsProps = {
	achievements: Array<Achievement | ApiAchievement>
}

function isApiAchievement(achievement: Achievement | ApiAchievement): achievement is ApiAchievement {
	return 'icon_HTML' in achievement
}

export function createAchievementElement(achievement: ApiAchievement, key: string | number) {
	const completed = achievement.progress >= achievement.completion_progress
	const progressPercent = achievement.completion_progress > 0 ? Math.min(100, Math.round((achievement.progress / achievement.completion_progress) * 100)) : 0

	return (
		<article
			data-testid="achievement-card"
			key={key}
			className={`flex flex-col justify-between group rounded-2xl border p-4 ${completed ? 'border-(--coalition-color)/40 bg-(--coalition-color)/8' : 'border-border bg-surface/50'}`}
		>
			<div className="flex items-center justify-between gap-4 mb-3">
				<div dangerouslySetInnerHTML={{ __html: achievement.icon_HTML }} />
				<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${completed ? 'bg-(--coalition-color)/20 text-text' : 'bg-card text-text-secondary'}`}>
					{completed ? 'Completado' : 'En progreso'}
				</span>
			</div>
			<div className="flex items-start justify-between gap-3">
				<h3 className="text-sm font-bold">{achievement.name}</h3>
			</div>
			<p className="mt-1 text-xs text-text-secondary">{achievement.description}</p>
			<div className="mt-4 h-1.5 overflow-hidden rounded-full bg-card">
				<div className="h-full bg-(--coalition-color)" style={{ width: `${progressPercent}%` }} />
			</div>
			<div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-text-secondary">
				<span>{progressPercent}%</span>
				<span>{achievement.completion_date ? `Fecha: ${achievement.completion_date}` : ''}</span>
			</div>
		</article>
	)
}

export function UserAchievements({ achievements }: UserAchievementsProps) {
	const completedAchievements = achievements.filter((achievement) => {
		if (isApiAchievement(achievement)) {
			return achievement.progress >= achievement.completion_progress
		}

		return achievement.completed
	}).length

	return (
		<div className="rounded-3xl border border-border bg-card p-6">
			<div className="mb-6 flex items-center justify-between">
				<h2 className="text-xl font-black">Logros</h2>
				<span className="text-xs font-semibold uppercase tracking-[0.18em] text-(--coalition-color)">
					{completedAchievements}/{achievements.length}
				</span>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				{achievements.map((achievement, index) => {
					if (isApiAchievement(achievement)) {
						return createAchievementElement(achievement, achievement.name || index)
					}

					const Icon = iconByAchievement[achievement.icon]
					const statusLabel = achievement.completed ? 'Completado' : 'En progreso'
					return (
						<article
							data-testid="achievement-card"
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
