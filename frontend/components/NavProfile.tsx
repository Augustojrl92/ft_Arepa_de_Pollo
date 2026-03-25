'use client'

import { useAuthStore } from '@/hooks';
import { Bell } from 'lucide-react'

export default function NavProfile() {
	const user = useAuthStore((s) => s.user)
	const logout = useAuthStore((s) => s.logout)

	return (
		<div className="flex items-center gap-5">
			<div className="flex items-center gap-2 bg-card-hover px-3 py-1 rounded-lg">
				<div className="w-2 h-2 rounded-full bg-green-500"></div>
				<span className="text-sm">Season 1 Active</span>
			</div>
			<div className="w-px h-8 bg-border"></div>
			<Bell />
			<img className="w-10 h-10 rounded-full bg-border object-cover" src={user?.avatar} alt={`Avatar of ${user?.username}`}/>
			<button onClick={() => void logout()}>Cerrar sesión</button>
		</div>
	);
}