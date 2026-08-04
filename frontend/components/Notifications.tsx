'use client'

import { BellIcon, CheckCircle2Icon, Gamepad2Icon, UserPlusIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { fetchMatches, MultiplayerMatch } from '@/lib/gameApi'
import { subscribeGameSocket } from '@/lib/gameSocket'
import { fetchMyPendingFriendRequests } from '@/lib/userApi'
import type { FriendEntry } from '@/types'
import styles from './Notifications.module.css'

type FriendActivity = {
	id: string
	login: string
}

export default function Notifications() {
	const [invitations, setInvitations] = useState<MultiplayerMatch[]>([])
	const [busyOutgoingInvitations, setBusyOutgoingInvitations] = useState<MultiplayerMatch[]>([])
	const [friendRequests, setFriendRequests] = useState<FriendEntry[]>([])
	const [friendActivities, setFriendActivities] = useState<FriendActivity[]>([])
	const [isOpen, setIsOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		let active = true
		const refresh = async () => {
			try {
				const [matches, friends] = await Promise.all([fetchMatches(), fetchMyPendingFriendRequests()])
				if (active) {
					setInvitations(matches.incoming)
					setBusyOutgoingInvitations(matches.outgoing.filter((match) => match.opponent_busy))
					setFriendRequests(friends.pendingReceived)
				}
			} catch {
				// Authentication state is handled globally; keep the last known count.
			}
		}

		void refresh()
		const unsubscribe = subscribeGameSocket({
			onEvent: (event) => {
				if (event.type === 'friend.event' && event.event === 'friend.request.accepted') {
					const currentLogin = window.localStorage.getItem('auth-login')?.toLowerCase()
					if (event.actor_login.toLowerCase() !== currentLogin) {
						setFriendActivities((current) => [
							{ id: `${event.actor_login}-${event.occurred_at}`, login: event.actor_login },
							...current,
						])
					}
				}
				void refresh()
			},
		})
		return () => {
			active = false
			unsubscribe()
		}
	}, [])

	const friendNotificationCount = friendRequests.length + friendActivities.length
	const gameNotificationCount = invitations.length + busyOutgoingInvitations.length

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
		<div className={styles.group}>
			<Link
				href={gameNotificationCount > 0 ? '/games?view=friends' : '/games'}
				className={`${styles.trigger} ${gameNotificationCount > 0 ? styles.triggerActive : ''}`}
				aria-label={gameNotificationCount > 0 ? `Avisos de partida pendientes: ${gameNotificationCount}` : 'Ir al juego'}
			>
				<Gamepad2Icon size={20} />
				{gameNotificationCount > 0 && <span className={styles.badge}>{gameNotificationCount > 9 ? '9+' : gameNotificationCount}</span>}
			</Link>

			<div className={styles.container} ref={containerRef}>
				<button
					type="button"
					className={styles.trigger}
					aria-label={`Notificaciones pendientes: ${friendNotificationCount}`}
					aria-expanded={isOpen}
					onClick={() => setIsOpen((current) => !current)}
				>
					<BellIcon size={20} />
					{friendNotificationCount > 0 && <span className={styles.badge}>{friendNotificationCount > 9 ? '9+' : friendNotificationCount}</span>}
				</button>

				{isOpen && (
					<section className={styles.menu} aria-label="Notificaciones">
						<header className={styles.heading}><strong>Notificaciones</strong><span>{friendNotificationCount}</span></header>
						{friendNotificationCount === 0 && <p className={styles.empty}>No tienes notificaciones pendientes.</p>}
						{friendActivities.length > 0 && <p className={styles.sectionLabel}>Actividad de amistad</p>}
						{friendActivities.map((activity) => (
							<Link
								className={styles.item}
								href={`/users/${encodeURIComponent(activity.login)}`}
								key={activity.id}
								onClick={() => {
									setFriendActivities((current) => current.filter((item) => item.id !== activity.id))
									setIsOpen(false)
								}}
							>
								<CheckCircle2Icon className={styles.icon} size={18} />
								<span className={styles.copy}><strong>{activity.login}</strong> aceptó tu solicitud de amistad.<small>Ahora forma parte de tus amigos</small></span>
							</Link>
						))}
						{friendRequests.length > 0 && <p className={styles.sectionLabel}>Solicitudes de amistad</p>}
						{friendRequests.map((request) => (
							<Link className={styles.item} href={`/users/${encodeURIComponent(request.login)}`} key={`friend-${request.userId}`} onClick={() => setIsOpen(false)}>
								<UserPlusIcon className={styles.icon} size={18} />
								<span className={styles.copy}><strong>{request.login}</strong> quiere ser tu amigo.<small>Abre su perfil para responder</small></span>
							</Link>
						))}
					</section>
				)}
			</div>
		</div>
	)
}
