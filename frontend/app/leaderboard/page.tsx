'use client'

import { Suspense } from "react"
import { LeaderboardUsers } from "./_components/LeaderboardUsers"

export default function Leaderboard() {
	return (
		<section className="py-5">
			<div className="py-6">
				<Suspense fallback={<div className="text-text-secondary mt-6">Cargando ranking...</div>}>
					<LeaderboardUsers />
				</Suspense>
			</div>
		</section>
	)
}
