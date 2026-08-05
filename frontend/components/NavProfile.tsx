'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks';
import { LogOut } from 'lucide-react'
import Notifications from '@/components/Notifications';

export default function NavProfile() {
	const pathname = usePathname();
	const { user, logout } = useAuthStore()
	const userProfilePath = user?.login ? `/users/${encodeURIComponent(user.login)}` : '/users'
	const isActive = pathname === userProfilePath || pathname.startsWith('/users/')

	return (
		<div className="flex items-center gap-3 md:gap-5">
			<div className="hidden items-center gap-2 bg-card-hover px-3 py-1 rounded-lg md:flex">
				<div className="w-2 h-2 rounded-full bg-green-500"></div>
				<span className="text-sm">Temporada 1 activa</span>
			</div>
			<div className="hidden w-px h-8 bg-border md:block"></div>
			<Notifications />
			<div className="hidden items-center gap-5 md:flex">
				<Link href={userProfilePath}>
					<img className={`w-10 h-10 rounded-full bg-border object-cover ${isActive ? 'border-2 border-card-hover ring ring-accent' : ''}`} src={user?.avatar} alt={`Avatar de ${user?.username}`}/>
				</Link>
				<LogOut className="cursor-pointer hover:text-accent transition-colors" size={16} onClick={logout} />
			</div>
		</div>
	);
}
