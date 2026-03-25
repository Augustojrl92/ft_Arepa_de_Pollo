'use client'

import { useState, useEffect } from "react"
import { useCoalitionStore } from "@/hooks"
import CoalitionCard from "./_components/CoalitionCard"

export default function CoalitionsPage() {
	const { coalitions, setCoalitions } = useCoalitionStore()

	useEffect(() => {
		setCoalitions()
	}, [setCoalitions])

	const orderedCoalitions = [...coalitions].sort((a, b) => b.score - a.score)

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


