'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { LeaderboardCorrections, LeaderboardUsers } from './_components'

const leaderboardTabs = [
	{ key: 'coalition-points', label: 'Puntos de coaliciones' },
	{ key: 'corrections', label: 'Numero de correcciones' },
] as const

export default function Leaderboard() {
	const searchParams = useSearchParams()
	const activeView = searchParams.get('view') === 'corrections' ? 'corrections' : 'coalition-points'

	return (
		<section className="py-5">
			<div className="py-6 space-y-6">
				<div className="flex flex-wrap gap-2 px-4 md:px-6">
					{leaderboardTabs.map((tab) => (
						<Link
							key={tab.key}
							href={`/leaderboard?view=${tab.key}`}
							className={`px-4 py-2 bg-card border rounded-lg flex items-center gap-3 transition-colors ${
								activeView === tab.key
									? 'border-accent bg-accent/14 text-accent shadow-[0_0_0_1px_rgba(255,255,255,0.04)]'
									: 'border-border text-text-secondary hover:text-text hover:bg-card-hover/70'
							}`}
						>
							<span className="text-xs font-bold uppercase">{tab.label}</span>
						</Link>
					))}
				</div>

				{activeView === 'corrections' ? <LeaderboardCorrections /> : <LeaderboardUsers />}
			</div>
		</section>
	)
}
