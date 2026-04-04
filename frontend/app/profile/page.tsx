'use client'

import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { useAuthStore, useCoalitionStore } from '@/hooks'
import { UserAchievements } from './_components/UserAchievements'
import { UserAllies } from './_components/UserAllies'
import { UserConfigurationModal } from './_components/UserConfigurationModal'
import { UserProfile } from './_components/UserProfile'
import { allowedPerPage, defaultPreferences, mockAchievements } from './_components/mockData'
import type { ProfilePreferences } from './_components/types'

export default function ProfilePage() {
	const { user, logout } = useAuthStore()
	const { coalitions } = useCoalitionStore()
	const { setTheme } = useTheme()

	const [preferences, setPreferences] = useState<ProfilePreferences>(defaultPreferences)
	const [preferencesReady, setPreferencesReady] = useState(false)
	const [isEditModalOpen, setIsEditModalOpen] = useState(false)

	useEffect(() => {
		const rawPreferences = window.localStorage.getItem('profilePreferences')
		const rawPerPage = window.localStorage.getItem('leaderboard.defaultPerPage')
		const parsedPerPage = Number.parseInt(rawPerPage ?? '', 10)
		const validPerPage = allowedPerPage.find((option) => option === parsedPerPage)

		if (rawPreferences) {
			try {
				const parsed = JSON.parse(rawPreferences) as Partial<ProfilePreferences>
				setPreferences((previous) => ({
					...previous,
					...parsed,
					rankingPerPage: validPerPage ?? parsed.rankingPerPage ?? previous.rankingPerPage,
				}))
			} catch {
				setPreferences({
					...defaultPreferences,
					rankingPerPage: validPerPage ?? defaultPreferences.rankingPerPage,
				})
			}
		} else if (validPerPage) {
			setPreferences((previous) => ({ ...previous, rankingPerPage: validPerPage }))
		}

		setPreferencesReady(true)
	}, [])

	useEffect(() => {
		if (!preferencesReady) {
			return
		}

		window.localStorage.setItem('profilePreferences', JSON.stringify(preferences))
		window.localStorage.setItem('leaderboard.defaultPerPage', String(preferences.rankingPerPage))
		setTheme(preferences.theme)
	}, [preferences, preferencesReady, setTheme])

	const profile = useMemo(
		() => ({
			name: user?.username ?? user?.login ?? 'Cadet_Unknown',
			login: user?.login ?? 'unknown_login',
			email: user?.email ?? 'unknown@campus42.fr',
			avatar: user?.avatar ?? 'https://api.dicebear.com/9.x/bottts/svg?seed=unknown',
			coalition: user?.coalition ?? 'Unassigned',
			level: user?.intraLevel ?? 0,
			points: user?.coalitionPoints ?? 0,
			wallet: user?.walletAmount ?? 0,
			evalPoints: user?.evalPoints ?? 0,
			campusRank: user?.campusUserRank,
			coalitionRank: user?.coalitionUserRank,
		}),
		[user]
	)

	const coalitionColor = useMemo(() => {
		if (!profile.coalition) {
			return '#00BABC'
		}

		const normalizedCoalition = profile.coalition.toLowerCase()
		const coalition = coalitions.find(
			(item) =>
				item.slug.toLowerCase() === normalizedCoalition
				|| item.name.toLowerCase() === normalizedCoalition
		)

		return coalition?.color || '#00BABC'
	}, [coalitions, profile.coalition])

	const coalitionStyle = {
		'--coalition-color': coalitionColor,
	} as CSSProperties

	const normalizedLevel = Math.max(profile.level, 0)
	const currentLevel = Math.floor(normalizedLevel)
	const nextLevel = currentLevel + 1
	const levelProgress = (normalizedLevel - currentLevel) * 100

	return (
		<div className="flex flex-col gap-4 my-8" style={coalitionStyle}>
			<UserProfile
				profile={profile}
				coalitionColor={coalitionColor}
				currentLevel={currentLevel}
				nextLevel={nextLevel}
				levelProgress={levelProgress}
				onLogout={() => void logout()}
				onOpenPreferences={() => setIsEditModalOpen(true)}
			/>

			<section className="grid gap-6 px-6 lg:grid-cols-2">
				<UserAllies currentLogin={profile.login} />
				<UserAchievements achievements={mockAchievements} />
			</section>

			<UserConfigurationModal
				isOpen={isEditModalOpen}
				preferences={preferences}
				onClose={() => setIsEditModalOpen(false)}
				onSave={(nextPreferences) => {
					setPreferences(nextPreferences)
					setIsEditModalOpen(false)
				}}
			/>
		</div>
	)
}
