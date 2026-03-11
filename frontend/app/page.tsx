'use client'

import UserCard from "./_components/UserCard"
import TournamentCard from "./_components/TournamentCard"
import CoalitionCard from "./_components/CoalitionCard"
import { User } from "@/types"
import { useState } from "react"

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
	const [user, setUser] = useState<User>(mockUser)
	const [modalUser, setModalUser] = useState<Boolean>(false)

	const handleChangeUser = () => {
		const newCoalition = (document.getElementById('coalition') as HTMLInputElement).value
		setUser(prev => ({ ...prev, coalition: newCoalition }))
	}

	return (
		<section className="py-5 flex gap-5">
			<UserCard user={user} />
			<TournamentCard coalitions={mockCoalitions} />
			<CoalitionCard user={user} />
			<div className="absolute top-4 left-8">
				<button className="cursor-pointer bg-card-hover px-4 py-2 rounded-lg" onClick={() => setModalUser(prev => !prev)}>Mock User</button>
				{modalUser && (
					<div className="p-10 bg-card/80 rounded-lg shadow-lg">
						<label htmlFor="coalition">Coalition</label>
						<select id="coalition" defaultValue={user.coalition} className="border p-2 rounded mb-2 w-full" onChange={handleChangeUser}>
							<option value="zefiria">Zefiria</option>
							<option value="tiamant">Tiamant</option>
							<option value="marventis">Marventis</option>
							<option value="ignisaria">Ignisaria</option>
						</select>
					</div>
				)}
			</div>
		</section>
	)
}
