"use client";
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useCoalitionStore } from '@/hooks';

export function ThemeToggleButton() {
	const { theme, setTheme } = useTheme();
	const { lastUpdate } = useCoalitionStore();
	const [mounted, setMounted] = useState(false);

	useEffect(() => { setMounted(true); }, []);

	if (!mounted) return <button aria-label="Toggle theme" />;

	return (
		<div className="flex items-center gap-4">
			<p className="text-sm text-text">Actualizado {lastUpdate || "Unknown"}</p>
			<button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
				{theme === "dark" ? (
					<Moon size={16} color="var(--color-accent)" className="cursor-pointer" />
				) : (
					<Sun size={16} color="var(--color-accent)" className="cursor-pointer" />
				)}
			</button>
		</div>
	)
}