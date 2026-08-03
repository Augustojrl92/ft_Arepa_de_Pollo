'use client'

import { BellIcon, CheckCircle2Icon, Gamepad2Icon, UserPlusIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { MouseEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import { fetchMatches, MultiplayerMatch } from '@/lib/gameApi'
import { subscribeGameSocket } from '@/lib/gameSocket'
import { fetchMyPendingFriendRequests } from '@/lib/userApi'
import type { FriendEntry } from '@/types'
import styles from './GameNotifications.module.css'

type FriendActivity = {
	id: string
	login: string
}

export default function GameNotifications() {
	const [invitations, setInvitations] = useState<MultiplayerMatch[]>([])
	const [friendRequests, setFriendRequests] = useState<FriendEntry[]>([])
	const [friendActivities, setFriendActivities] = useState<FriendActivity[]>([])
	const [isOpen, setIsOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const pathname = usePathname()
	const searchParams = useSearchParams()

	const handleDestinationClick = (
		event: MouseEvent<HTMLAnchorElement>,
		href: string,
		afterClick?: () => void,
	) => {
		afterClick?.()
		setIsOpen(false)

		const currentQuery = searchParams.toString()
		const currentHref = currentQuery ? `${pathname}?${currentQuery}` : pathname

		if (currentHref === href) {
			event.preventDefault()
			window.location.assign(href)
		}
	}

	useEffect(() => {
		let active = true
		const refresh = async () => {
			try {
				const [matches, friends] = await Promise.all([fetchMatches(), fetchMyPendingFriendRequests()])
				if (active) {
					setInvitations(matches.incoming)
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

	const notificationCount = invitations.length + friendRequests.length + friendActivities.length

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
				aria-label={`Notificaciones pendientes: ${notificationCount}`}
				aria-expanded={isOpen}
				onClick={() => setIsOpen((current) => !current)}
			>
				<BellIcon size={20} />
				{notificationCount > 0 && <span className={styles.badge}>{notificationCount > 9 ? '9+' : notificationCount}</span>}
			</button>

			{isOpen && (
				<section className={styles.menu} aria-label="Notificaciones">
					<header className={styles.heading}><strong>Notificaciones</strong><span>{notificationCount}</span></header>
					{notificationCount === 0 && <p className={styles.empty}>No tienes notificaciones pendientes.</p>}
					{friendActivities.length > 0 && <p className={styles.sectionLabel}>Actividad de amistad</p>}
					{friendActivities.map((activity) => (
						<Link
							className={styles.item}
							href={`/users/${encodeURIComponent(activity.login)}`}
							key={activity.id}
							onClick={(event) => handleDestinationClick(
								event,
								`/users/${encodeURIComponent(activity.login)}`,
								() => setFriendActivities((current) => current.filter((item) => item.id !== activity.id)),
							)}
						>
							<CheckCircle2Icon className={styles.icon} size={18} />
							<span className={styles.copy}><strong>{activity.login}</strong> aceptó tu solicitud de amistad.<small>Ahora forma parte de tus amigos</small></span>
						</Link>
					))}
					{friendRequests.length > 0 && <p className={styles.sectionLabel}>Solicitudes de amistad</p>}
					{friendRequests.map((request) => (
						<Link className={styles.item} href={`/users/${encodeURIComponent(request.login)}`} key={`friend-${request.userId}`} onClick={(event) => handleDestinationClick(event, `/users/${encodeURIComponent(request.login)}`)}>
							<UserPlusIcon className={styles.icon} size={18} />
							<span className={styles.copy}><strong>{request.login}</strong> quiere ser tu amigo.<small>Abre su perfil para responder</small></span>
						</Link>
					))}
					{invitations.length > 0 && <p className={styles.sectionLabel}>Invitaciones de PPTLS</p>}
					{invitations.map((match) => (
							<Link className={styles.item} href="/games?view=friends" key={match.id} onClick={(event) => handleDestinationClick(event, '/games?view=friends')}>
								<Gamepad2Icon className={styles.icon} size={18} />
								<span className={styles.copy}><strong>{match.inviter.display_name}</strong> te ha invitado a jugar.<small>Primero a {match.target_score}</small></span>
							</Link>
						))}
				</section>
			)}
		</div>
	)
}
