'use client'

import { useCoalitionStore } from "@/hooks"
import CoalitionCard from "./_components/CoalitionCard"

export default function CoalitionsPage() {
	const { coalitions, isCoalitionsLoading } = useCoalitionStore()

	const orderedCoalitions = [...coalitions].sort((a, b) => b.score - a.score)

	// Show skeleton while coalitions are loading for the first time
	if (isCoalitionsLoading && coalitions.length === 0) {
		return (
			<section className="py-5">
				<ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
					{Array.from({ length: 4 }).map((_, i) => (
						<li key={i} className="h-48 bg-surface-elevated rounded-lg animate-pulse" />
					))}
				</ul>
			</section>
		)
	}

	return (
		<section className="py-5">

			<ul className="grid grid-cols-2 gap-5">
				{orderedCoalitions.map((coalition, index) => (
					<li key={coalition.id}>
						<CoalitionCard coalition={coalition} index={index} />
					</li>
				))}
			</ul>

		</section>
	)
}


