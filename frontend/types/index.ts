export interface User {
	id: number
	username: string
	email: string
	avatar: string
	login: string
	coalition: string
	intraLevel: number
	coalitionPoints: number
	coalitionRank: number | null
	campusUserRank: number | null
	coalitionUserRank: number | null
	walletAmount: number
	evalPoints: number
}

export interface TopMember {
	login: string
	level: number
	points: number
	avatarUrl?: string
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
}

export interface RankingEntry {
	rank: number
	login: string
	displayName: string
	avatar: string
	coalition: string
	coalitionPoints: number
	intraLevel: number
}