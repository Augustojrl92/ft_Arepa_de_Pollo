import type { ProfilePreferences, RankingPerPage } from './types'

export const allowedPerPage: RankingPerPage[] = [10, 25, 50, 100]

export const defaultPreferences: ProfilePreferences = {
	rankingPerPage: 25,
	showSensitiveData: true,
	notificationsEnabled: true,
	theme: 'system',
}