'use client'

import { useEffect } from "react"
import { useCoalitionStore } from "@/hooks"
import { LeaderboardUsers } from "./_components/LeaderboardUsers"

export default function Leaderboard() {
	const { ranking, getRanking } = useCoalitionStore()

	useEffect(() => {
		getRanking()
	}, [getRanking])

	return (
		<section className="py-5">
			<div className="py-6">
				<LeaderboardUsers ranking={ranking} />
			</div>
		</section>
	)
}


