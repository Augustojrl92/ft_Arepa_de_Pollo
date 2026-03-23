'use client'

import { useEffect } from "react"
import { useCoalitionStore } from "@/hooks"
import CoalitionCard from "./_components/CoalitionCard"

export default function Leaderboard() {
	const { coalitions, setCoalitions, maxPoints } = useCoalitionStore()

	useEffect(() => {
		setCoalitions()
	}, [setCoalitions])

	const orderedCoalitions = [...coalitions].sort((a, b) => b.points - a.points)

	return (
		<section className="py-5">
			<ul className="flex flex-col gap-5">
				{orderedCoalitions.map((coalition, index) => (
					<li key={coalition.id}>
						<CoalitionCard coalition={coalition} index={index} isLeader={coalition.points === maxPoints} maxPoints={maxPoints} />
					</li>
				))}
			</ul>
		</section>
	)
}

