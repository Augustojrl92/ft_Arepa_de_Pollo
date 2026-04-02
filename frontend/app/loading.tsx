export default function RootLoading() {
	return (
		<section className="py-6">
			<div className="space-y-4 animate-pulse">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="h-28 rounded-xl bg-card border border-border" />
					<div className="h-28 rounded-xl bg-card border border-border" />
					<div className="h-28 rounded-xl bg-card border border-border" />
				</div>
				<div className="h-72 rounded-xl bg-card border border-border" />
			</div>
		</section>
	)
}
