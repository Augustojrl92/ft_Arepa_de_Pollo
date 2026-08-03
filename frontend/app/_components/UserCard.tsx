'use client'

import CardContainer from "@/components/CardContainer"
import { useAuthStore, useCoalitionStore } from "@/hooks"

export default function UserCard() {
	const { user } = useAuthStore()
	if (!user) return null

	const coalition = useCoalitionStore((s) => s.coalitions.find(c => c.slug === user?.coalition))
	const coalitionPoints = user.coalitionPoints > 1000 
		? `${(user.coalitionPoints / 1000).toFixed(0)}K`
		: user.coalitionPoints.toLocaleString("en-US")
	const coalitionRank = user.coalitionUserRank ? `#${user.coalitionUserRank}` : "-"
	return (
		<CardContainer className="relative flex items-center gap-4 w-full sm:gap-8 lg:min-w-80 lg:w-auto lg:shrink-0">
			<span className="absolute top-3 right-3 text-4xl text-border font-bold sm:text-6xl">{coalitionRank}</span>
			<div className="relative shrink-0">
				<img style={{ outlineColor: coalition?.color }} src={user.avatar} alt={user.login} className={`border-4 border-card outline-3 w-25 h-25 rounded-full object-cover`} />
				<span style={{ borderColor: coalition?.color}} className={`coalition-level`}>LVL {user.intraLevel}</span>
			</div>
			<div className="flex min-w-0 flex-col gap-1 items-start">
				<h2 className="text-2xl font-bold">{user.login}</h2>
				<p className={`coalition-badge ${user.coalition}`}>{coalition?.name}</p>
				<div className="flex items-start justify-between mt-5 gap-4 sm:gap-10">
					<div>
						<p className="text-2xl font-bold">{user.walletAmount}</p>
						<p className="text-[10px] text-text-secondary font-semibold uppercase">Wallet</p>
					</div>
					<div>
						<p className="text-2xl font-bold">{coalitionPoints}</p>
						<p className="text-[10px] text-text-secondary font-semibold uppercase">Coalition<br />Points</p>
					</div>
					<div>
						<p style={{ color: coalition?.color }} className={`text-2xl font-bold`}>{user.evalPoints}</p>
						<p className="text-[10px] text-text-secondary font-semibold uppercase">Eval Points</p>
					</div>
				</div>
			</div>
		</CardContainer>
	)
}
