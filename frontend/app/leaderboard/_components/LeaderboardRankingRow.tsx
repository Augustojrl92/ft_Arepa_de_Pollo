'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { Coalition, RankingEntry } from '@/types'

interface LeaderboardRankingRowProps {
	coalition?: Coalition
	formattedPoints: string
	isCurrentUser: boolean
	user: RankingEntry
}

export const LeaderboardRankingRow = ({ coalition, formattedPoints, isCurrentUser, user }: LeaderboardRankingRowProps) => {
	return (
		<tr className={`hover:bg-card-hover/70 transition-colors group ${isCurrentUser ? 'bg-accent/10' : ''}`}>
			<td className="px-6 py-4 font-mono font-regular">
				<span className="text-accent">{String(user.rank).padStart(2, '0')}</span> | <span style={{ color: coalition?.color || 'var(--color-text-secondary)' }}>{String(user.coalitionRank).padStart(2, '0')}</span>
			</td>
			<td className="px-6 py-4">
				<div className="flex items-center gap-3">
					<div className="w-8 h-8 rounded-full bg-background shrink-0 overflow-hidden border border-border">
						<Image
							src={user.avatar}
							alt={user.displayName || user.login}
							width={32}
							height={32}
							unoptimized
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
				{formattedPoints}
			</td>
		</tr>
	)
}