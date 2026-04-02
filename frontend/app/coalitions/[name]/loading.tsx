export default function CoalitionDetailLoading() {
	return (
		<section className="py-8 space-y-6 animate-pulse">
			<div className="h-6 w-48 rounded bg-card border border-border" />
			<div className="h-64 rounded-xl bg-card border border-border" />
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="h-28 rounded-xl bg-card border border-border" />
				<div className="h-28 rounded-xl bg-card border border-border" />
				<div className="h-28 rounded-xl bg-card border border-border" />
				<div className="h-28 rounded-xl bg-card border border-border" />
			</div>
			<div className="h-64 rounded-xl bg-card border border-border" />
		</section>
	)
}
