import UserCard from "./_components/UserCard"
import TournamentCard from "./_components/TournamentCard"
import CoalitionCard from "./_components/CoalitionCard"

const mockCoalitions = [
	{ name: "Tiamant", totalPoints: 89000 },
	{ name: "Zefiria", totalPoints: 75000 },
	{ name: "Marventis", totalPoints: 62000 },
	{ name: "Ignisaria", totalPoints: 54000 },
]

export default function Home() {
	return (
		<section className="py-5 flex gap-5">
			<UserCard />
			<TournamentCard coalitions={mockCoalitions} />
			<CoalitionCard />
		</section>
	)
}
