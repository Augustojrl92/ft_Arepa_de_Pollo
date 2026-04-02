import UserCard from "./_components/UserCard"
import TournamentCard from "./_components/TournamentCard"
import CoalitionCard from "./_components/CoalitionCard"
import CoalitionPointsChart from "../components/CoalitionPointsChart"

export default function Home() {
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
		</>
	)
}
