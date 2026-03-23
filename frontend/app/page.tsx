import UserCard from "./_components/UserCard"
import TournamentCard from "./_components/TournamentCard"
import CoalitionCard from "./_components/CoalitionCard"

const mockCoalitions = [
	{ id: 1, name: "Tiamant", points: 89000 },
	{ id: 2, name: "Zefiria", points: 75000 },
	{ id: 3, name: "Marventis", points: 62000 },
	{ id: 4, name: "Ignisaria", points: 54000 },
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
