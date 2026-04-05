export type Ally = {
	login: string
	coalition: string
	level: number
	avatar: string
	online: boolean
}

export type Achievement = {
	title: string
	description: string
	completed: boolean
	completionDate?: string
	progress: number
	icon: 'medal' | 'rocket' | 'shield' | 'swords'
}

export type IncomingAllyRequest = {
	id: string
	login: string
	coalition: string
	level: number
	avatar: string
}

export type SentAllyRequest = {
	id: string
	login: string
	createdAt: string
}

export type RankingPerPage = 10 | 25 | 50 | 100

export type ProfilePreferences = {
	rankingPerPage: RankingPerPage
	showSensitiveData: boolean
	notificationsEnabled: boolean
	theme: 'light' | 'dark' | 'system'
}

export type UserProfileView = {
	name: string
	login: string
	email: string
	avatar: string
	coalition: string
	level: number
	points: number
	wallet: number
	evalPoints: number
	campusRank?: number | null
	coalitionRank?: number | null
}
