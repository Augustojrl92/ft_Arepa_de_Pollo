'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
	{ title: 'Dashboard', href: '/' },
	{ title: 'Leaderboard', href: '/leaderboard' },
	{ title: 'Social', href: '#' }
];

export default function NavLink() {
	const pathname = usePathname();

	return (
		<ul className="flex gap-2 items-center">
			{navigation.map((item, i) => (
				<li key={i}>
					<Link className={`nav-item ${pathname === item.href ? 'active' : ''}`} href={item.href}>{item.title}</Link>
				</li>
			))}
		</ul>
	);
}