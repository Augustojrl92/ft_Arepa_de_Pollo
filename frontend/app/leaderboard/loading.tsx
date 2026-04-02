export default function LeaderboardLoading() {
	return (
		<section className="py-5">
			<div className="py-6 space-y-6 animate-pulse">
				<div className="h-10 w-80 rounded-lg bg-card border border-border" />
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="h-24 rounded-xl bg-card border border-border" />
					<div className="h-24 rounded-xl bg-card border border-border" />
					<div className="h-24 rounded-xl bg-card border border-border" />
				</div>
				<div className="h-96 rounded-xl bg-card border border-border" />
			</div>
		</section>
	)
}
