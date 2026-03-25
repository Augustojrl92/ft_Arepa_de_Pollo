'use client'

import CardContainer from "@/components/CardContainer"
import { useAuthStore, useCoalitionStore } from "@/hooks"

export default function UserCard() {
	const user = useAuthStore((s) => s.user)
	const coalition = useCoalitionStore((s) => s.coalitions.find(c => c.slug === user?.coalition))

	if (!user) return null
	
	const { coaColor, outline, border } = coalitionStyles[user.coalition] ?? { coaColor: "", outline: "", border: "" }
	const coalitionLabel = user.coalition
		? user.coalition[0].toUpperCase() + user.coalition.slice(1)
		: "-"
	const coalitionPoints = user.coalitionPoints > 1000 
		? `${(user.coalitionPoints / 1000).toFixed(0)}K`
		: user.coalitionPoints.toLocaleString("en-US")
	const coalitionRank = user.coalitionRank ? `#${user.coalitionRank}` : "-"
	return (
		<CardContainer className="relative flex items-center gap-8 min-w-80 shrink-0">
			<span className="absolute top-3 right-3 text-6xl text-border font-bold">{coalitionRank}</span>
			<div className="relative">
				<img style={{ outlineColor: coalition?.color }} src={user.avatar} alt={user.login} className={`border-4 border-card outline-3 w-25 h-25 rounded-full object-cover`} />
				<span style={{ borderColor: coalition?.color}} className={`coalition-level`}>LVL {user.intraLevel}</span>
			</div>
			<div className="flex flex-col gap-1 items-start">
				<h2 className="text-2xl font-bold">{user.login}</h2>
				<p className={`coalition-badge ${user.coalition}`}>{coalitionLabel}</p>
				<div className="flex items-start justify-between mt-5 gap-10">
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
