"use client";
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggleButton() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => { setMounted(true); }, []);

	// Hasta que el componente esté montado en el cliente no rendericemos
	// el icono, evitando el mismatch de hidratación con SSR.
	if (!mounted) return <button aria-label="Toggle theme" />;

	return (
		<button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
			{theme === "dark" ? (
				<Moon size={16} color="var(--color-accent)" className="cursor-pointer"/>
			) : (
				<Sun size={16} color="var(--color-accent)" className="cursor-pointer"/>
			)}
		</button>
	)
}