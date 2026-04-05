'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks';
import { Bell } from 'lucide-react'

export default function NavProfile() {
	const pathname = usePathname();
	const user = useAuthStore((s) => s.user)
	const userProfilePath = user?.login ? `/users/${encodeURIComponent(user.login)}` : '/users'
	const isActive = pathname === userProfilePath || pathname.startsWith('/users/')

	return (
		<div className="flex items-center gap-5">
			<div className="flex items-center gap-2 bg-card-hover px-3 py-1 rounded-lg">
				<div className="w-2 h-2 rounded-full bg-green-500"></div>
				<span className="text-sm">Season 1 Active</span>
			</div>
			<div className="w-px h-8 bg-border"></div>
			<Bell />
			<Link href={userProfilePath}>
				<img className={`w-10 h-10 rounded-full bg-border object-cover ${isActive ? 'border-2 border-card-hover ring ring-accent' : ''}`} src={user?.avatar} alt={`Avatar of ${user?.username}`}/>
			</Link>
		</div>
	);
}