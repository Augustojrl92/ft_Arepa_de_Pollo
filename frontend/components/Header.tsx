import NavLink from '@/components/NavLink';
import NavProfile from '@/components/NavProfile';

export default function Header() {
	return (
		<header className="bg-card p-4 border-b-2 border-border">
			<div className="aedlph-container flex min-w-0 items-center justify-between gap-2">
				<NavLink />
				<NavProfile />
			</div>
		</header>
	);
}
