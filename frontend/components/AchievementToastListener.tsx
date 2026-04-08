'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuthStore, useUserStore } from '@/hooks'

const POLL_INTERVAL_MS = 30_000

export default function AchievementToastListener() {
	const status = useAuthStore((state) => state.status)
	const user = useAuthStore((state) => state.user)
	const getMyAchievements = useUserStore((state) => state.getMyAchievements)
	const refreshAchievementEvents = useUserStore((state) => state.refreshAchievementEvents)
	const seenEventIdsRef = useRef<Set<number>>(new Set())

	useEffect(() => {
		if (status !== 'authenticated' || !user) {
			seenEventIdsRef.current.clear()
			return
		}

		let cancelled = false

		const notifyPendingEvents = async () => {
			const events = await refreshAchievementEvents()

			if (cancelled || events.length === 0) {
				return
			}

			let hasNewEvent = false

			events.forEach((event) => {
				if (seenEventIdsRef.current.has(event.id)) {
					return
				}

				seenEventIdsRef.current.add(event.id)
				hasNewEvent = true

				if (event.event_type === 'achievement.completed') {
					toast.success(`Has desbloqueado "${event.payload.achievement_title}"`, {
						description: 'Nuevo logro conseguido. Revisa tu perfil para ver el progreso actualizado.',
					})
					return
				}

				toast.info('Nuevo evento de logros detectado', {
					description: event.payload.achievement_title,
				})
			})

			if (hasNewEvent) {
				void getMyAchievements()
			}
		}

		void notifyPendingEvents()
		const intervalId = window.setInterval(() => {
			void notifyPendingEvents()
		}, POLL_INTERVAL_MS)

		return () => {
			cancelled = true
			window.clearInterval(intervalId)
		}
	}, [getMyAchievements, refreshAchievementEvents, status, user])

	return null
}
