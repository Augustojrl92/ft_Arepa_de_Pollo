'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
	{ title: 'Leaderboard', href: '/leaderboard' },
	{ title: 'Coalitions', href: '/coalitions' }
];

export default function NavLink() {
	const pathname = usePathname();

	const isActive = (href: string) => pathname === href || pathname.includes(href + '/');
	return (
		<div className="flex items-center gap-8">
			<Link href="/">
				<h1 className={`text-xl font-bold ${isActive('/') ? 'text-accent' : ''}`}>AEDLPH</h1>
			</Link>
			<ul className="flex gap-2 items-center">
				{navigation.map((item, i) => (
					<li key={i}>
						<Link className={`nav-item ${isActive(item.href) ? 'active' : ''}`} href={item.href}>{item.title}</Link>
					</li>
				))}
			</ul>
		</div>
	);
}