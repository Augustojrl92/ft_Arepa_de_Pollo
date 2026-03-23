'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { useCoalitionStore } from "@/hooks"
import CardContainer from "@/components/CardContainer"
import { Crown, ArrowLeft } from "lucide-react"

const coalitionColor: Record<string, { bgColor: string; textColor: string }> = {
	tiamant: { bgColor: "bg-coalition-tiamant", textColor: "text-coalition-tiamant" },
	zefiria: { bgColor: "bg-coalition-zefiria", textColor: "text-coalition-zefiria" },
	marventis: { bgColor: "bg-coalition-marventis", textColor: "text-coalition-marventis" },
	ignisaria: { bgColor: "bg-coalition-ignisaria", textColor: "text-coalition-ignisaria" },
}

export default function CoalitionDetailPage({
	params,
}: {
	params: Promise<{ name: string }>
}) {
	const { coalitions, setCoalitions, maxPoints } = useCoalitionStore()
	const [name, setName] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		params.then((p) => {
			setName(p.name)
			setIsLoading(false)
		})
	}, [params])

	useEffect(() => {
		if (coalitions.length === 0 && !isLoading) {
			setCoalitions()
		}
	}, [coalitions.length, isLoading, setCoalitions])

	const coalition = coalitions.find(
		(c) => c.name.toLowerCase() === name?.toLowerCase()
	)

	if (isLoading || !name) {
		return (
			<section className="p-4">
				<div className="animate-pulse">Loading...</div>
			</section>
		)
	}

	if (!coalition) {
		return (
			<section className="p-4">
				<Link href="/leaderboard" className="flex items-center gap-2 text-text-secondary hover:text-text mb-6">
					<ArrowLeft size={20} />
					Back to Leaderboard
				</Link>
				<CardContainer className="text-center py-8">
					<p className="text-text-secondary">Coalition "{name}" not found</p>
				</CardContainer>
			</section>
		)
	}

	const colors = coalitionColor[coalition.name.toLowerCase()] ?? coalitionColor.tiamant
	const formattedPoints = coalition.points > 1000
		? `${(coalition.points / 1000).toFixed(1)}K`
		: coalition.points.toLocaleString("en-US")
	const progression = Math.round((coalition.points / maxPoints) * 100)
	const rank = coalitions.sort((a, b) => b.points - a.points).findIndex((c) => c.id === coalition.id) + 1

	return (
		<section className="p-4 space-y-6">
			<Link href="/leaderboard" className="flex items-center gap-2 text-text-secondary hover:text-text transition-colors">
				<ArrowLeft size={20} />
				Back to Leaderboard
			</Link>

			{/* Header */}
			<CardContainer className={`relative overflow-hidden p-8 ${colors.bgColor} bg-opacity-5 border-2 border-opacity-30`}>
				<div className="flex items-start justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<h1 className="text-4xl font-bold capitalize">{coalition.name}</h1>
							{rank === 1 && <Crown className="text-[#F59E0B]" size={40} />}
						</div>
						<p className={`text-lg font-semibold`}>#{rank} Position</p>
					</div>
					<div className="text-right">
						<p className="text-sm text-text-secondary mb-1">Total Points</p>
						<p className="text-5xl font-bold">{formattedPoints}</p>
					</div>
				</div>
			</CardContainer>

			{/* Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<CardContainer className="p-6">
					<p className="text-text-secondary text-sm mb-2">Ranking</p>
					<p className="text-3xl font-bold">#{rank}</p>
				</CardContainer>
				<CardContainer className="p-6">
					<p className="text-text-secondary text-sm mb-2">Progress</p>
					<p className="text-3xl font-bold">{progression}%</p>
				</CardContainer>
				<CardContainer className="p-6">
					<p className="text-text-secondary text-sm mb-2">vs Leader</p>
					<p className="text-3xl font-bold">{maxPoints - coalition.points > 0 ? `+${(maxPoints - coalition.points).toLocaleString('en-US')}` : 'Leader'}</p>
				</CardContainer>
			</div>

			{/* Progress Bar */}
			<CardContainer className="p-6">
				<div className="flex items-center justify-between mb-3">
					<h2 className="font-bold">Overall Progress</h2>
					<span className="text-sm text-text-secondary">{progression}%</span>
				</div>
				<div className="w-full h-4 bg-border rounded-full overflow-hidden">
					<div
						className={`h-full ${colors.bgColor} transition-all duration-500`}
						style={{ width: `${progression}%` }}
					/>
				</div>
			</CardContainer>

			{/* About */}
			<CardContainer className="p-6">
				<h2 className="text-lg font-bold mb-4">About {coalition.name}</h2>
				<p className="text-text-secondary text-sm">
					{coalition.name} is one of the four coalitions competing in Tournament. 
					With {formattedPoints} points, they are currently in position #{rank}.
				</p>
			</CardContainer>
		</section>
	)
}
