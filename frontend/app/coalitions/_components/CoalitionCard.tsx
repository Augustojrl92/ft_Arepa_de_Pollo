import Link from "next/link"
import CardContainer from "@/components/CardContainer"
import { useCoalitionStore } from "@/hooks"
import { Coalition } from "@/types"
import { Crown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react"

export default function CoalitionCard({ coalition, index }: { coalition: Coalition; index: number; }) {

	const { maxScore } = useCoalitionStore()

	const isLeader = coalition.score === maxScore
	const isPositive = coalition.scoreChange24h >= 0

	return (
		<Link href={`/coalitions/${coalition.name.toLowerCase()}`} className="block">
			<CardContainer className="relative flex flex-col gap-6 hover:opacity-90 transition-opacity p-6">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-3 flex-1">
						<div className="overflow-hidden rounded w-16 h-16 shrink-0 hover:scale-105 transition-transform">
							<img 
								src={coalition.imageUrl} 
								alt={coalition.name} 
								className="w-full h-full object-cover"
								loading="lazy"
							/>
						</div>
						<div className="flex items-center gap-2">
							{isLeader && <Crown fill="#F59E0B" strokeWidth={0} size={24} />}
							<h2 className="font-bold text-2xl">{coalition.name}</h2>
						</div>
					</div>
					<div className="text-right">
						<p className="text-xs text-text-secondary mb-1">Puntuación</p>
						<span className="text-lg font-bold bg-card-hover px-4 py-2 rounded-lg block">{coalition.score.toLocaleString()}</span>
					</div>
				</div>

				<div className="w-full h-4 bg-border rounded overflow-hidden">
					<div 
						className="h-full rounded" 
						style={{ 
							width: `${(coalition.score / maxScore) * 100}%`, 
							backgroundColor: coalition.color
						}}
					/>
				</div>

				<div className="grid grid-cols-3 gap-4">
					<div className="bg-surface p-4 rounded">
						<p className="text-text-secondary mb-2 font-medium text-xs uppercase">Activos</p>
						<p className="font-bold text-2xl">{coalition.activeMembers}</p>
						<p className="text-xs text-text-secondary">de {coalition.memberCount}</p>
					</div>
					<div className="bg-surface p-4 rounded">
						<p className="text-text-secondary mb-2 font-medium text-xs uppercase">Nivel prom.</p>
						<p className="font-bold text-3xl">{coalition.averageLevel.toFixed(1)}</p>
					</div>
					<div className="bg-surface p-4 rounded">
						<p className="text-text-secondary font-medium text-xs uppercase flex items-center gap-1 mb-2">
							{isPositive ? (
								<TrendingUp size={16} className="text-green-500" />
							) : (
								<TrendingDown size={16} className="text-red-500" />
							)}
							24h
						</p>
						<p className={`font-bold text-2xl ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
							{isPositive ? '+' : ''}{(coalition.scoreChange24h / 1000).toFixed(0)}k
						</p>
					</div>
				</div>

				{/* {coalition.topMembers.length > 0 && (
					<div className="pt-4 border-t border-border">
						<p className="text-xs text-text-secondary mb-3 uppercase font-semibold">Top 3 miembros</p>
						<div className="flex gap-3">
							{coalition.topMembers.slice(0, 3).map((member, i) => (
								<div key={i} className="flex-1 p-3 bg-surface rounded">
									<p className="font-bold text-lg mb-1">#{i + 1}</p>
									<p className="font-semibold text-sm truncate">{member.login}</p>
									<p className="text-xs text-text-secondary mt-1">Lvl {member.level}</p>
								</div>
							))}
						</div>
					</div>
				)} */}

				<div className="flex items-center justify-between pt-2">
					<span className="text-xs text-text-secondary font-semibold">Ranking #{index + 1}</span>
					<ChevronRight size={18} className="text-text-secondary" />
				</div>
			</CardContainer>
		</Link>
	)
}