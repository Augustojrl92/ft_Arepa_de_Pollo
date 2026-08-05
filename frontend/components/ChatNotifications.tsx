'use client'

import { MessageCircleIcon, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useChatNotifications } from '@/hooks/useChatSocket'
import styles from './Notifications.module.css'

export default function ChatNotifications() {
	const { notifications, removeNotification } = useChatNotifications()
	const [isOpen, setIsOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

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

	const notificationCount = notifications.length

	return (
		<div className={styles.container} ref={containerRef}>
			<button
				type="button"
				className={`${styles.trigger} ${notificationCount > 0 ? styles.triggerActive : ''}`}
				aria-label={`Notificaciones de chat: ${notificationCount}`}
				aria-expanded={isOpen}
				onClick={() => setIsOpen((current) => !current)}
			>
				<MessageCircleIcon size={20} />
				{notificationCount > 0 && (
					<span className={styles.badge}>
						{notificationCount > 9 ? '9+' : notificationCount}
					</span>
				)}
			</button>

			{isOpen && (
				<section className={styles.menu} aria-label="Notificaciones de chat">
					<header className={styles.heading}>
						<strong>Mensajes sin leer</strong>
						<span>{notificationCount}</span>
					</header>
					<div className={styles.list}>
						{notificationCount === 0 && (
							<p className={styles.empty}>No tienes mensajes sin leer.</p>
						)}
						{notifications.map((notification) => (
						<div
							key={notification.id}
							className={styles.item}
							style={{
								display: 'grid',
								gridTemplateColumns: '1fr auto',
								alignItems: 'start',
							}}
						>
							<div className={styles.copy}>
								<strong>{notification.from_login}</strong>
								<small>{notification.message.substring(0, 50)}...</small>
								<small style={{ fontSize: '0.6rem', color: 'var(--color-text-secondary)' }}>
									{new Date(notification.timestamp).toLocaleTimeString()}
								</small>
							</div>
							<button
								type="button"
								onClick={() => removeNotification(notification.id)}
								style={{
									background: 'transparent',
									border: 'none',
									cursor: 'pointer',
									color: 'var(--color-text-secondary)',
									padding: '0.25rem',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									flexShrink: 0,
									marginLeft: '0.5rem',
								}}
								aria-label={`Descartar notificación de ${notification.from_login}`}
							>
								<X size={16} />
							</button>
						</div>
					))}
					</div>
				</section>
			)}
		</div>
	)
}