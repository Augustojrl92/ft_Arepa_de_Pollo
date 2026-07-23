'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
	{ title: 'Leaderboard', href: '/leaderboard' },
	{ title: 'Coalitions', href: '/coalitions' },
	{ title: 'Juegos', href: '/games' },
	{ title: 'Status', href: '/status' },
];

export default function NavLink() {
	const pathname = usePathname();

	const isActive = (href: string) => pathname === href || pathname.includes(href + '/');
	return (
		<div className="flex min-w-0 items-center gap-3 md:gap-8">
			<Link href="/">
				<h1 className={`text-xl font-bold ${isActive('/') ? 'text-accent' : ''}`}>AEDLPH</h1>
			</Link>
			<ul className="flex min-w-0 items-center gap-1 overflow-x-auto md:gap-2">
				{navigation.map((item, i) => (
					<li key={i}>
						<Link className={`nav-item whitespace-nowrap text-sm md:text-base ${isActive(item.href) ? 'active' : ''}`} href={item.href}>{item.title}</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
