'use client'

import { useState, useEffect } from "react"
import { useCoalitionStore } from "@/hooks"

export default function Leaderboard() {
	const { coalitions, setCoalitions } = useCoalitionStore()
	const [activeTab, setActiveTab] = useState<'coalitions' | 'users'>('users')

	useEffect(() => {
		setCoalitions()
	}, [setCoalitions])

	const orderedCoalitions = [...coalitions].sort((a, b) => b.score - a.score)

	return (
		<section className="py-5">
			<div className="mb-8">
				<div className="flex gap-2 border-b border-border">
					<button
						onClick={() => setActiveTab('coalitions')}
						className={`px-4 py-3 font-semibold transition-colors ${activeTab === 'coalitions'
								? 'text-accent border-b-2 border-accent'
								: 'text-text-secondary hover:text-text'
							}`}
					>
						Coaliciones
					</button>
					<button
						onClick={() => setActiveTab('users')}
						className={`px-4 py-3 font-semibold transition-colors ${activeTab === 'users'
								? 'text-accent border-b-2 border-accent'
								: 'text-text-secondary hover:text-text'
							}`}
					>
						Usuarios
					</button>
				</div>
			</div>

			<div className="text-center py-12">
				<p className="text-text-secondary">Leaderboard de usuarios próximamente</p>
			</div>
		</section>
	)
}


