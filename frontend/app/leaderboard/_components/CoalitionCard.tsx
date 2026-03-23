import Link from "next/link"
import CardContainer from "@/components/CardContainer"
import { Coalition } from "@/types"
import { Crown, ChevronRight } from "lucide-react"

const coalitionColor: Record<string, { bgColor: string }> = {
	tiamant: { bgColor: "bg-coalition-tiamant" },
	zefiria: { bgColor: "bg-coalition-zefiria" },
	marventis: { bgColor: "bg-coalition-marventis" },
	ignisaria: { bgColor: "bg-coalition-ignisaria" },
}

export default function CoalitionCard({ coalition, index, isLeader, maxPoints }: { coalition: Coalition; index: number; isLeader: boolean; maxPoints: number }) {

	const { bgColor } = coalitionColor[coalition.name.toLowerCase()] ?? { bgColor: "bg-gray-500" }
	const formattedPoints = coalition.points > 1000
		? `${(coalition.points / 1000).toFixed(0)}K`
		: coalition.points.toLocaleString("en-US")

	return (
		<Link href={`/leaderboard/${coalition.name.toLowerCase()}`} className="block hover:opacity-80 transition-opacity">
			<CardContainer className="relative flex flex-col gap-6 w-full">
				<div className="flex items-center justify-between w-full">
					<div className="flex items-center gap-2">
						{isLeader && <Crown fill="#F59E0B" strokeWidth={0} />}
						<h2 className="font-bold">{coalition.name}</h2>
					</div>
					<span className="text-xs bg-card-hover px-3 py-1 rounded-lg">{formattedPoints} pts</span>
				</div>
				<div className="w-full h-3 bg-border rounded overflow-hidden">
					<div className={`h-full ${bgColor} rounded`} style={{ width: `${(coalition.points / maxPoints) * 100}%` }}></div>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-xs text-text-secondary">Rank #{index + 1}</span>
					<ChevronRight size={16} className="text-text-secondary" />
				</div>
			</CardContainer>
		</Link>
	)
}