import { User } from "@/types"
import CardContainer from "@/components/CardContainer"

const coalitionStyles: Record<string, { coaColor: string; outline: string; border: string }> = {
	tiamant: { coaColor: "text-coalition-tiamant", outline: "outline-coalition-tiamant", border: "border-coalition-tiamant" },
	zefiria: { coaColor: "text-coalition-zefiria", outline: "outline-coalition-zefiria", border: "border-coalition-zefiria" },
	marventis: { coaColor: "text-coalition-marventis", outline: "outline-coalition-marventis", border: "border-coalition-marventis" },
	ignisaria: { coaColor: "text-coalition-ignisaria", outline: "outline-coalition-ignisaria", border: "border-coalition-ignisaria" },
}

export default function UserCard({ user }: { user: User }) {
	const { coaColor, outline, border } = coalitionStyles[user.coalition] ?? { coaColor: "", outline: "", border: "" }
	const coalitionPoints = user.coalitionPoints > 1000 
		? `${(user.coalitionPoints / 1000).toFixed(0)}K`
		: user.coalitionPoints.toLocaleString("en-US")
	return (
		<CardContainer className="relative flex items-center gap-8">
			<span className="absolute top-3 right-3 text-6xl text-border font-bold">#{user.coalitionRank}</span>
			<div className="relative">
				<img src={user.avatar} alt={user.login} className={`border-4 border-card outline-3 ${outline} w-25 h-25 rounded-full`} />
				<span className={`coalition-level ${border}`}>LVL {user.intraLevel}</span>
			</div>
			<div className="flex flex-col gap-1 items-start">
				<h2 className="text-2xl font-bold">{user.login}</h2>
				<p className={`coalition-badge ${user.coalition}`}>{user.coalition[0].toUpperCase() + user.coalition.slice(1)}</p>
				<div className="flex items-start justify-between mt-5 gap-10">
					<div>
						<p className="text-2xl font-bold">{user.walletAmount}</p>
						<p className="text-[10px] text-text-secondary font-semibold uppercase">Wallet</p>
					</div>
					<div>
						<p className="text-2xl font-bold">{coalitionPoints}</p>
						<p className="text-[10px] text-text-secondary font-semibold uppercase">Coalition<br />Points</p>
					</div>
					<div>
						<p className={`text-2xl font-bold ${coaColor}`}>{user.evalPoints}</p>
						<p className="text-[10px] text-text-secondary font-semibold uppercase">Eval Points</p>
					</div>
				</div>
			</div>
		</CardContainer>
	)
}