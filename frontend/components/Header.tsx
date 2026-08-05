'use client'

import { LogOut, MenuIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/hooks';
import NavLink, { navigation } from '@/components/NavLink';
import NavProfile from '@/components/NavProfile';

export default function Header() {
	const [menuOpen, setMenuOpen] = useState(false);
	const pathname = usePathname();
	const headerRef = useRef<HTMLElement>(null);
	const { user, logout } = useAuthStore();
	const userProfilePath = user?.login ? `/users/${encodeURIComponent(user.login)}` : '/users';

	useEffect(() => {
		const closeOnOutsideClick = (event: PointerEvent) => {
			if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setMenuOpen(false);
		};
		document.addEventListener('pointerdown', closeOnOutsideClick);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('pointerdown', closeOnOutsideClick);
			document.removeEventListener('keydown', closeOnEscape);
		};
	}, []);

	const isActive = (href: string) => pathname === href || pathname.includes(href + '/');

	return (
		<header className="bg-card border-b-2 border-border" ref={headerRef}>
			<div className="aedlph-container flex min-w-0 items-center justify-between gap-2 p-4">
				<NavLink />
				<div className="flex items-center gap-2 md:gap-5">
					<NavProfile />
					<button
						type="button"
						className="grid place-items-center rounded-lg p-2 transition-colors hover:bg-card-hover hover:text-accent md:hidden"
						aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
						aria-expanded={menuOpen}
						onClick={() => setMenuOpen((current) => !current)}
					>
						{menuOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
					</button>
				</div>
			</div>

			{menuOpen && (
				<nav className="border-t border-border md:hidden" aria-label="Navegación móvil">
					<ul className="aedlph-container flex flex-col gap-1 py-3">
						{navigation.map((item, i) => (
							<li key={i}>
								<Link
									className={`nav-item block whitespace-nowrap text-sm ${isActive(item.href) ? 'active' : ''}`}
									href={item.href}
									onClick={() => setMenuOpen(false)}
								>
									{item.title}
								</Link>
							</li>
						))}
					</ul>
					<div className="aedlph-container flex items-center justify-between gap-2 border-t border-border py-3">
						<Link href={userProfilePath} className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
							<img className="h-9 w-9 rounded-full bg-border object-cover" src={user?.avatar} alt={`Avatar de ${user?.username}`} />
							<span className="text-sm font-medium">{user?.username ?? 'Perfil'}</span>
						</Link>
						<button
							type="button"
							className="nav-item flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
							onClick={() => {
								setMenuOpen(false);
								logout();
							}}
						>
							<LogOut size={16} />
							Cerrar sesión
						</button>
					</div>
				</nav>
			)}
		</header>
	);
}
