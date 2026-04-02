export default function LoginLoading() {
	return (
		<section className="min-h-screen bg-surface flex items-center justify-center px-4">
			<div className="w-full max-w-sm space-y-6 animate-pulse">
				<div className="h-10 w-32 mx-auto rounded bg-card border border-border" />
				<div className="h-56 rounded-xl bg-card border border-border" />
			</div>
		</section>
	)
}
