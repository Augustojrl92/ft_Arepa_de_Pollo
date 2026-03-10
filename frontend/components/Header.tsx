import Link from 'next/link';
import NavLink from '@/components/NavLink';
import { Bell } from 'lucide-react'

export default function Header() {
	return (
		<header className="bg-card p-4 border-b-2 border-border">
			<div className="aedlph-container flex items-center justify-between">
				<div className="flex items-center gap-8">
					<Link href="/">
						<h1 className="text-xl font-bold">AEDLPH</h1>
					</Link>
					<NavLink />
				</div>
				<div className="flex items-center gap-5">
					<div className="flex items-center gap-2 bg-card-hover px-3 py-1 rounded-lg">
						<div className="w-2 h-2 rounded-full bg-green-500"></div>
						<span className="text-sm">Season 1 Active</span>
					</div>
					<div className="w-px h-8 bg-border"></div>
					<Bell />
					<div className="w-10 h-10 rounded-full bg-border"></div>
				</div>
			</div>
		</header>
	);
}
