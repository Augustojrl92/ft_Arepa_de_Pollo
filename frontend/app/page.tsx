'use client'

import UserCard from "./_components/UserCard"
import TournamentCard from "./_components/TournamentCard"
import CoalitionCard from "./_components/CoalitionCard"
import CoalitionPointsChart from "../components/CoalitionPointsChart"
import Chat from "../components/Chat"
import { useCoalitionStore } from "@/hooks"

export default function Home() {
	const { isCoalitionsLoading, coalitions } = useCoalitionStore()

	// Mostrar skeletons mientras se cargan las coaliciones
	if (isCoalitionsLoading && coalitions.length === 0) {
		return (
			<>
				<section className="py-5 flex gap-5">
					<div className="min-w-80 h-32 bg-surface-elevated rounded-lg animate-pulse" />
					<div className="min-w-80 h-32 bg-surface-elevated rounded-lg animate-pulse" />
					<div className="min-w-80 h-32 bg-surface-elevated rounded-lg animate-pulse" />
				</section>
				<section>
					<div className="h-80 bg-surface-elevated rounded-lg animate-pulse" />
				</section>
			</>
		)
	}

	return (
		<>
			<section className="py-5 flex gap-5">
				<UserCard />
				<TournamentCard />
				<CoalitionCard />
			</section>
			<section>
				<CoalitionPointsChart />
			</section>
			<Chat />
		</>
	)
}
