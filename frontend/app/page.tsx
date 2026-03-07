import UserCard from "./_components/UserCard"
import TournamentCard from "./_components/TournamentCard"
import { User } from "@/types"

const mockUser: User = {
	avatar: 'https://i.pravatar.cc/150?img=51',
	login: 'fmorenil',
	coalition: 'tiamant',
	intraLevel: 8.99,
	coalitionPoints: 89000,
	coalitionRank: 42,
	walletAmount: 1337,
	evalPoints: 6
}

const mockCoalitions = [
	{ name: "Tiamant", totalPoints: 89000 },
	{ name: "Zefiria", totalPoints: 75000 },
	{ name: "Marventis", totalPoints: 62000 },
	{ name: "Ignisaria", totalPoints: 54000 },
]

export default function Home() {
	return (
		<section className="py-5 flex gap-5">
			<UserCard user={mockUser} />
			<TournamentCard coalitions={mockCoalitions} />
		</section>
	)
}
