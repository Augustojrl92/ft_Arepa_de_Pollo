'use client'

import CardContainer from "@/components/CardContainer"
import { useAuthStore } from "@/hooks" 
import { Medal } from "lucide-react"

const coalitionStyles: Record<string, { bgColor: string }> = {
	tiamant: { bgColor: "bg-coalition-tiamant" },
	zefiria: { bgColor: "bg-coalition-zefiria" },
	marventis: { bgColor: "bg-coalition-marventis" },
	ignisaria: { bgColor: "bg-coalition-ignisaria" },
}

export default function CoalitionCard() {
	const user = useAuthStore((s) => s.user)
	if (!user) return null

	const { bgColor } = coalitionStyles[user.coalition] ?? { coaColor: "", outline: "", border: "" }
	const coalitionLabel = user.coalition
		? user.coalition[0].toUpperCase() + user.coalition.slice(1)
		: "-"
	const campusUserRank = user.campusUserRank ? `#${user.campusUserRank}` : "-"
	const coalitionUserRank = user.coalitionUserRank ? `#${user.coalitionUserRank}` : "-"

	return (
		<CardContainer className={`relative flex flex-col justify-between gap-8 min-w-80 shrink-0 ${bgColor}`}>
			<div className="flex items-center justify-between">
				<Medal />
				<span className="uppercase text-sm font-bold bg-white/25 px-3 py-1 rounded-lg">Your ranks</span>
			</div>
			<div>
				<p className="text-sm text-white/70 uppercase font-bold">42 Madrid</p>
				<span className="font-bold text-4xl">{campusUserRank}</span>
				<div className="flex flex-col mt-3 pt-3 border-t border-white/70">
					<span className="text-sm text-white/70 uppercase font-bold">{coalitionLabel}</span>
					<span className="font-bold text-2xl">{coalitionUserRank}</span>
				</div>
			</div>
		</CardContainer>
	)
}
