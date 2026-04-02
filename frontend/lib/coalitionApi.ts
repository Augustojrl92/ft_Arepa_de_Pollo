import { Coalition, RankingPage } from "@/types"
import { authFetchJson } from "@/lib/authApi"

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const COALITION_BASE_URL = `${API_URL}/api/coalitions/`

type CoalitionApiItem = {
	id: number
	name: string
	slug: string
	image_url?: string
	cover_url?: string
	color?: string
	score?: number
	member_count?: number
	active_members?: number
	average_level?: number
}

type CoalitionApiResponse = {
	coalitions?: CoalitionApiItem[]
}

type RankingApiItem = {
	rank: number
	login: string
	display_name: string
	avatar_url: string
	coalition: string
	coalition_points: number
	intra_level: number
	coalition_rank: number
}

type RankingApiResponse = {
	page?: number
	per_page?: number
	total?: number
	total_pages?: number
	users?: RankingApiItem[]
}

type CoalitionDetailsApiResponse = {
	coalition: {
		level_distribution: { range: string, count: number }[],
		average_level: number,
		score_change_24: number | null,
		score_change_weekly: number | null,
		score_change_monthly: number | null,
		campus_rank: number | null,
		campus_rank_change: number | null,
		campus_rank_status: "up" | "down" | "same" | null,
		top_members: {
			login: string,
			display_name: string,
			avatar_url: string,
			coalition_points: number,
			intra_level: number,
		}[],
		total_members: number,
		active_members: number,

	}
}

export const fetchCoalitions = async (): Promise<Coalition[]> => {
	const payload = await authFetchJson<CoalitionApiResponse>(COALITION_BASE_URL, {
		method: "GET",
	}, "Failed to fetch coalitions")
	const coalitions = payload.coalitions ?? []

	return coalitions.map((coalition) => ({
		id: coalition.id,
		name: coalition.name,
		slug: coalition.slug,
		imageUrl: coalition.image_url ?? "",
		coverUrl: coalition.cover_url ?? "",
		color: coalition.color ?? "",
		score: coalition.score ?? 0,
		memberCount: coalition.member_count ?? 0,
		activeMembers: coalition.active_members ?? 0,
		averageLevel: coalition.average_level ?? 0,
	}))
}

export const fetchRanking = async ({
	page = 1,
	perPage = 30,
	coalition,
}: {
	page?: number
	perPage?: number
	coalition?: string
} = {}): Promise<RankingPage> => {
	const params = new URLSearchParams({
		page: String(page),
		per_page: String(perPage),
	})

	if (coalition) {
		params.set("coalition", coalition)
	}

	const payload = await authFetchJson<RankingApiResponse>(`${COALITION_BASE_URL}users-ranking/?${params.toString()}`, {
		method: "GET",
	}, "Failed to fetch ranking")
	const ranking = payload.users ?? []

	return {
		page: payload.page ?? page,
		perPage: payload.per_page ?? perPage,
		total: payload.total ?? ranking.length,
		totalPages: payload.total_pages ?? (ranking.length > 0 ? 1 : 0),
		users: ranking.map((entry) => ({
			rank: entry.rank,
			coalitionRank: entry.coalition_rank,
			login: entry.login,
			displayName: entry.display_name,
			avatar: entry.avatar_url,
			coalition: entry.coalition,
			coalitionPoints: entry.coalition_points,
			intraLevel: entry.intra_level,
		})),
	}
}

export const fetchCoalitionDetails = async (slug: string) => {
	const payload = await authFetchJson<CoalitionDetailsApiResponse>(`${COALITION_BASE_URL}details/?coalition=${encodeURIComponent(slug)}`, {
		method: "GET",
	}, "Failed to fetch coalition details")
	const coalition = payload.coalition

	return {
		levelDistribution: coalition.level_distribution,
		averageLevel: coalition.average_level,
		campusRank: coalition.campus_rank,
		scoreChange24h: coalition.score_change_24,
		scoreChangeWeekly: coalition.score_change_weekly,
		scoreChangeMonthly: coalition.score_change_monthly,
		campusRankChange: coalition.campus_rank_change,
		campusRankStatus: coalition.campus_rank_status,
		topMembers: coalition.top_members.map((member) => ({
			login: member.login,
			displayName: member.display_name,
			avatar: member.avatar_url,
			points: member.coalition_points,
			level: member.intra_level,
		})),
		totalMembers: coalition.total_members,
		activeMembers: coalition.active_members,
	}

}
