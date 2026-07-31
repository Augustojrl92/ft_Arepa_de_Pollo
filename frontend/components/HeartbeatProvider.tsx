'use client'

import { useEffect } from 'react'
import { useAuthStore, useUserStore } from '@/hooks'

export function HeartbeatProvider({ children }: { children: React.ReactNode }) {
	const { user } = useAuthStore()
	const { startHeartbeat } = useUserStore()

	useEffect(() => {
		if (user) {
			startHeartbeat()
		}
	}, [startHeartbeat, user])

	return <>{children}</>
}
