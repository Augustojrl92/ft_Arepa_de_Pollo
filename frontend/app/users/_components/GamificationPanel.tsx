'use client'

import { CheckCircle2Icon, TargetIcon, TrophyIcon, ZapIcon } from 'lucide-react'

import { mockGamification } from './mockData'

export function GamificationPanel() {
	const { profile, dailyChallenges } = mockGamification
	const progressPercent = Math.min(100, (profile.levelXp / profile.nextLevelXp) * 100)

	return (
		<section className="mx-6 border-y border-border py-6" aria-labelledby="gamification-title">
			<div className="mb-5 flex flex-wrap items-end justify-between gap-3">
				<div>
					<p className="flex items-center gap-2 text-xs font-semibold uppercase text-text-secondary">
						<TrophyIcon size={15} /> Progreso
					</p>
					<div className="mt-1 flex flex-wrap items-center gap-2">
						<h2 id="gamification-title" className="text-xl font-bold">Nivel {profile.level}</h2>
						<span className="rounded border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-text-secondary">
							Demo local
						</span>
					</div>
				</div>
				<div className="flex items-center gap-2 text-sm font-semibold text-accent">
					<ZapIcon size={16} /> {profile.xp} XP
				</div>
			</div>

			<div className="mb-6">
				<div className="mb-2 flex justify-between text-xs text-text-secondary">
					<span>{profile.levelXp} XP</span>
					<span>{profile.nextLevelXp} XP</span>
				</div>
				<div className="h-2 overflow-hidden rounded bg-surface">
					<div className="h-full bg-accent" style={{ width: `${progressPercent}%` }} />
				</div>
			</div>

			<div className="mb-3 flex items-center gap-2">
				<TargetIcon size={17} className="text-accent" />
				<h3 className="text-sm font-bold">Retos de hoy</h3>
			</div>
			<div className="grid gap-3 md:grid-cols-3">
				{dailyChallenges.map((challenge) => {
					const challengeProgress = Math.min(100, (challenge.progress / challenge.target) * 100)
					return (
						<article key={challenge.code} className="rounded-lg border border-border bg-surface p-4">
							<div className="flex items-start justify-between gap-2">
								<strong className="text-sm">{challenge.title}</strong>
								{challenge.completed && <CheckCircle2Icon size={17} className="shrink-0 text-green-400" />}
							</div>
							<div className="mt-3 h-1.5 overflow-hidden rounded bg-card">
								<div className="h-full bg-accent" style={{ width: `${challengeProgress}%` }} />
							</div>
							<div className="mt-2 flex justify-between text-xs text-text-secondary">
								<span>{challenge.progress}/{challenge.target}</span>
								<span>+{challenge.xpReward} XP</span>
							</div>
						</article>
					)
				})}
			</div>
		</section>
	)
}
