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

export interface Coalition {
	name: string
	totalPoints: number
}