export interface User {
	id: number
	username: string
	email: string
	avatar: string
	login: string
	coalition: string
	intraLevel: number
	coalitionPoints: number
	campusUserRank: number | null
	coalitionUserRank: number | null
	walletAmount: number
	evalPoints: number
}

export interface UserDetails {
	id: number
	login: string
	displayName: string
	avatar: string
	level: number
	coalitionName: string
	coalitionSlug: string
	coalitionPoints: number
	coalitionRank: number | null
	campusRank: number | null
	achievements?: AchievementsPayload | null
}

export interface Achievement {
	id: number
	slug: string
	title: string
	description: string
	icon: string
	completed: boolean
	completionDate?: string | null
	completion_date?: string | null
	progress: number
	status: 'completed' | 'in_progress'
}

export interface AchievementsPayload {
	ownerUserId: number
	completedCount: number
	inProgressCount: number
	achievementsCount: number
	achievements: Achievement[]
}

export interface AchievementEventPayload {
	user_id: number
	achievement_id: number
	achievement_slug: string
	achievement_title: string
	status: 'completed'
	progress: number
	completed_at: string
}

export interface AchievementEvent {
	id: number
	event_type: string
	payload: AchievementEventPayload
	created_at: string
}

export interface FriendEntry {
	userId: number
	username: string
	login: string
	displayName: string
	avatarUrl: string
}

export interface FriendsPayload {
	ownerUserId: number
	friendsCount?: number
	pendingReceivedCount: number
	pendingSentCount: number
	friends?: FriendEntry[]
	pendingReceived: FriendEntry[]
	pendingSent: FriendEntry[]
}

export interface TopMember {
	login: string
	displayName: string
	level: number
	points: number
	avatar: string
}

interface CoalitionDetails {
	levelDistribution: { range: string, count: number }[]
	averageLevel: number
	scoreChange24h: number | null
	scoreChangeWeekly: number | null
	scoreChangeMonthly: number | null
	campusRank: number | null
	campusRankChange: number | null
	campusRankStatus: "up" | "down" | "same" | null
	topMembers: TopMember[]
	totalMembers: number | 1
	activeMembers: number | 0
}

export interface Coalition {
	id: number
	name: string
	slug: string
	imageUrl: string
	coverUrl: string
	color: string
	score: number
	memberCount: number
	activeMembers: number
	averageLevel: number
	details?: CoalitionDetails
}

export interface RankingEntry {
	rank: number
	coalitionRank: number
	login: string
	displayName: string
	avatar: string
	coalition: string
	coalitionPoints: number
	intraLevel: number
}

export interface RankingPage {
	users: RankingEntry[]
	page: number
	perPage: number
	total: number
	totalPages: number
}
