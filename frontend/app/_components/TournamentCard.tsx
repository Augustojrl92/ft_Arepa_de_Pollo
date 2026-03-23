import CardContainer from "@/components/CardContainer"
import { Coalition } from "@/types"
import { Crown } from "lucide-react"

const coalitionColor: Record<string, { bgColor: string }> = {
	tiamant: { bgColor: "bg-coalition-tiamant" },
	zefiria: { bgColor: "bg-coalition-zefiria" },
	marventis: { bgColor: "bg-coalition-marventis" },
	ignisaria: { bgColor: "bg-coalition-ignisaria" },
}

export default function TournamentCard({ coalitions }: { coalitions: Coalition[] }) {
	const maxPoints = Math.max(...coalitions.map(c => c.points))

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
				{coalitions.map((coalition, i) => {
					const coalitionPoints = coalition.points > 1000
						? `${(coalition.points / 1000).toFixed(0)}K`
						: coalition.points.toLocaleString("en-US")
					const {bgColor} = coalitionColor[coalition.name.toLowerCase()] ?? { bgColor: "bg-gray-500" }

					return (
						<div key={coalition.name} className="flex flex-col items-center gap-2 w-full text-text-secondary">
							<div className={`w-full flex items-center justify-between ${maxPoints === coalition.points ? 'text-text' : ''}`}>
								<div className="flex items-center gap-2">
									<p className={`text-xs font-semibold ${maxPoints === coalition.points ? 'text-[#F59E0B]' : ''}`}>0{i + 1}</p>
									<p className={`text-xs font-semibold`}>{coalition.name}</p>
								</div>
								<p className={`text-xs font-semibold`}>{coalitionPoints}</p>
							</div>
							<div className="w-full h-1 bg-border rounded overflow-hidden">
								<div className={`h-full ${bgColor} rounded`} style={{ width: `${(coalition.points / maxPoints) * 100}%` }}></div>
							</div>
						</div>
					)
				})}
			</div>
		</CardContainer>
	)
}