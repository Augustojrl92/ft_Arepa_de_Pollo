'use client'

import CardContainer from "@/components/CardContainer"
import { useAuthStore, useCoalitionStore } from "@/hooks" 
import { Medal } from "lucide-react"

export default function CoalitionCard() {
	const { user } = useAuthStore()

	if (!user) return null

	const coalition = useCoalitionStore((s) => s.coalitions.find(c => c.slug === user?.coalition))
	const campusUserRank = user.campusUserRank ? `#${user.campusUserRank}` : "-"
	const coalitionUserRank = user.coalitionUserRank ? `#${user.coalitionUserRank}` : "-"

	return (
		<CardContainer style={{ backgroundColor: coalition?.color }} className="relative flex flex-col justify-between gap-8 min-w-80 shrink-0">
			<div className="flex items-center justify-between">
				<Medal />
				<span className="uppercase text-sm font-bold bg-white/25 px-3 py-1 rounded-lg">Your ranks</span>
			</div>
			<div>
				<p className="text-sm text-white/70 uppercase font-bold">42 Madrid</p>
				<span className="font-bold text-4xl">{campusUserRank}</span>
				<div className="flex flex-col mt-3 pt-3 border-t border-white/70">
					<span className="text-sm text-white/70 uppercase font-bold">{coalition?.name}</span>
					<span className="font-bold text-2xl">{coalitionUserRank}</span>
				</div>
			</div>
		</CardContainer>
	)
}
