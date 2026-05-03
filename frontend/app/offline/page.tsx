import Link from "next/link";

export default function OfflinePage() {
	return (
		<section className="flex min-h-[70vh] items-center justify-center py-10">
			<div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-sm">
				<div className="space-y-4">
					<p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
						Offline mode
					</p>
					<h1 className="text-3xl font-bold text-text">Connection unavailable</h1>
					<p className="text-base leading-7 text-text-secondary">
						This PWA only guarantees offline access for the public status page,
						the offline fallback page, and previously cached static assets.
						Private data and login flows still require a live backend connection.
					</p>
				</div>

				<div className="mt-8 flex flex-wrap gap-3">
					<Link
						href="/status"
						className="rounded-lg border border-accent bg-accent/12 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/18"
					>
						Open status page
					</Link>
					<Link
						href="/"
						className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-card-hover/70 hover:text-text"
					>
						Try the homepage
					</Link>
				</div>
			</div>
		</section>
	);
}
