export interface User {
	id: number
	username: string
	email: string
	avatar: string
	login: string
	coalition: string
	intraLevel: number
	coalitionPoints: number
	coalitionRank: number
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
	scoreChange24h: number
	scoreChangeWeekly: number
	scoreChangeMonthly: number
	topMembers: TopMember[]
	allMembers: TopMember[]
	description: string
	foundedDate: string
	memberGrowth: number
	levelDistribution: {
		range: string
		count: number
	}[]
}