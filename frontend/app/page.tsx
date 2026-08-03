'use client'

import UserCard from "./_components/UserCard"
import TournamentCard from "./_components/TournamentCard"
import CoalitionCard from "./_components/CoalitionCard"
import CoalitionPointsChart from "../components/CoalitionPointsChart"
import Chat from "../components/Chat"
import { useAuthStore, useCoalitionStore } from "@/hooks"

export default function Home() {
	const { isCoalitionsLoading, coalitions } = useCoalitionStore()
	const user = useAuthStore((state) => state.user)

	// Mostrar skeletons mientras se cargan las coaliciones
	if (isCoalitionsLoading && coalitions.length === 0) {
		return (
			<>
				<section className="py-5 flex flex-col gap-5 lg:flex-row">
					<div className="h-32 w-full bg-surface-elevated rounded-lg animate-pulse lg:min-w-80 lg:w-auto" />
					<div className="h-32 w-full bg-surface-elevated rounded-lg animate-pulse lg:min-w-80 lg:w-auto" />
					<div className="h-32 w-full bg-surface-elevated rounded-lg animate-pulse lg:min-w-80 lg:w-auto" />
				</section>
				<section>
					<div className="h-80 bg-surface-elevated rounded-lg animate-pulse" />
				</section>
			</>
		)
	}

	return (
		<>
			<section className="py-5 flex flex-col gap-5 lg:flex-row">
				<UserCard />
				<TournamentCard />
				<CoalitionCard />
			</section>
				<section>
					<CoalitionPointsChart userLogin={user?.login ?? null} />
				</section>
				<Chat />
		</>
	)
}
