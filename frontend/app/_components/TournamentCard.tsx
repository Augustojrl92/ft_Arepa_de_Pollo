'use client'

import { useEffect, useState } from "react"

import CardContainer from "@/components/CardContainer"
import { getCoalitionLeaderboard } from "@/lib/authApi"
import { Coalition } from "@/types"
import { Crown } from "lucide-react"

const coalitionColor: Record<string, { bgColor: string }> = {
	tiamant: { bgColor: "bg-coalition-tiamant" },
	zefiria: { bgColor: "bg-coalition-zefiria" },
	marventis: { bgColor: "bg-coalition-marventis" },
	ignisaria: { bgColor: "bg-coalition-ignisaria" },
}

export default function TournamentCard() {
	const [coalitions, setCoalitions] = useState<Coalition[]>([])

	useEffect(() => {
		let cancelled = false

		const loadLeaderboard = async () => {
			try {
				const payload = await getCoalitionLeaderboard()
				if (!cancelled) {
					setCoalitions(payload.coalitions ?? [])
				}
			} catch {
				if (!cancelled) {
					setCoalitions([])
				}
			}
		}

		loadLeaderboard()

		return () => {
			cancelled = true
		}
	}, [])

	if (coalitions.length === 0) {
		return null
	}

	const maxPoints = Math.max(...coalitions.map(c => c.totalPoints))

	return (
		<CardContainer className="relative flex flex-col items-center gap-5 w-full">
			<div className="flex items-center justify-between w-full">
				<div className="flex items-center gap-2">
					<Crown fill="#F59E0B" strokeWidth={0} />
					<h2 className="font-bold">Coalition Tournament</h2>
				</div>
				<span className="text-xs bg-card-hover px-3 py-1 rounded-lg">Last update: 8 min ago</span>
			</div>
			<div className="flex flex-col gap-3 w-full">
				{orderedCoalitions.map((coalition, i) => {
					const coalitionScore = coalition.score > 1000
						? `${(coalition.score / 1000).toFixed(0)}K`
						: coalition.score.toLocaleString("en-US")

					return (
						<div key={coalition.name} className="flex flex-col items-center gap-2 w-full text-text-secondary">
							<div className={`w-full flex items-center justify-between ${maxScore === coalition.score ? 'text-text' : ''}`}>
								<div className="flex items-center gap-2">
									<p className={`text-xs font-semibold ${maxScore === coalition.score ? 'text-[#F59E0B]' : ''}`}>0{i + 1}</p>
									<p className={`text-xs font-semibold`}>{coalition.name}</p>
								</div>
								<p className={`text-xs font-semibold`}>{coalitionScore}</p>
							</div>
							<div className="w-full h-1 bg-border rounded overflow-hidden">
								<div className={`h-full rounded`} style={{ width: `${(coalition.score / maxScore) * 100}%`, backgroundColor: coalition.color }}></div>
							</div>
						</div>
					)
				})}
			</div>
		</CardContainer>
	)
}
