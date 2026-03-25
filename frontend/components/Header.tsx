import Link from 'next/link';
import NavLink from '@/components/NavLink';
import NavProfile from '@/components/NavProfile';

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
				<NavProfile />
			</div>
		</header>
	);
}
