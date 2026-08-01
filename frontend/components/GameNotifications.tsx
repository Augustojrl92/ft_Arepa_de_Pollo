'use client'

import { BellIcon, Gamepad2Icon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { fetchMatches, MultiplayerMatch } from '@/lib/gameApi'
import styles from './GameNotifications.module.css'

export default function GameNotifications() {
	const [invitations, setInvitations] = useState<MultiplayerMatch[]>([])
	const [isOpen, setIsOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		let active = true
		const refresh = async () => {
			try {
				const matches = await fetchMatches()
				if (active) setInvitations(matches.incoming)
			} catch {
				// Authentication state is handled globally; keep the last known count.
			}
		}

		void refresh()
		const interval = window.setInterval(() => void refresh(), 5000)
		return () => {
			active = false
			window.clearInterval(interval)
		}
	}, [])

	useEffect(() => {
		const closeOnOutsideClick = (event: PointerEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
		}
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsOpen(false)
		}
		document.addEventListener('pointerdown', closeOnOutsideClick)
		document.addEventListener('keydown', closeOnEscape)
		return () => {
			document.removeEventListener('pointerdown', closeOnOutsideClick)
			document.removeEventListener('keydown', closeOnEscape)
		}
	}, [])

	return (
		<div className={styles.container} ref={containerRef}>
			<button
				type="button"
				className={styles.trigger}
				aria-label={`Invitaciones de PPTLS: ${invitations.length}`}
				aria-expanded={isOpen}
				onClick={() => setIsOpen((current) => !current)}
			>
				<BellIcon size={20} />
				{invitations.length > 0 && <span className={styles.badge}>{invitations.length > 9 ? '9+' : invitations.length}</span>}
			</button>

			{isOpen && (
				<section className={styles.menu} aria-label="Notificaciones de PPTLS">
					<header className={styles.heading}><strong>Invitaciones de PPTLS</strong><span>{invitations.length}</span></header>
					{invitations.length === 0
						? <p className={styles.empty}>No tienes invitaciones pendientes.</p>
						: invitations.map((match) => (
							<Link className={styles.item} href="/games?view=friends" key={match.id} onClick={() => setIsOpen(false)}>
								<Gamepad2Icon className={styles.icon} size={18} />
								<span className={styles.copy}><strong>{match.inviter.display_name}</strong> te ha invitado a jugar.<small>Primero a {match.target_score}</small></span>
							</Link>
						))}
				</section>
			)}
		</div>
	)
}
