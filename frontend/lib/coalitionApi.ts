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
	last_time_update?: string
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
	evaluations_done_total?: number
	evaluations_done_current_season?: number
}

type RankingApiResponse = {
	page?: number
	per_page?: number
	total?: number
	total_pages?: number
	users?: RankingApiItem[]
}

const RANKING_FETCH_PAGE_SIZE = 200
const RANKING_PARALLEL_REQUESTS = 4

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

export const fetchCoalitions = async (): Promise<{ coalitions: Coalition[], lastUpdate: string | null }> => {
	const payload = await authFetchJson<CoalitionApiResponse>(COALITION_BASE_URL, {
		method: "GET",
	}, "Failed to fetch coalitions")
	const coalitions = payload.coalitions ?? []
	const lastUpdate = payload.last_time_update ?? null

	const parsedCoalitions = coalitions.map((coalition) => ({
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
	return { coalitions: parsedCoalitions, lastUpdate }
}

const fetchRankingPage = async ({
	page,
	perPage,
	coalition,
}: {
	page: number
	perPage: number
	coalition?: string
}): Promise<RankingPage> => {
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
			evaluationsDoneTotal: entry.evaluations_done_total ?? 0,
			evaluationsDoneCurrentSeason: entry.evaluations_done_current_season ?? 0,
		})),
	}
}

export const fetchRanking = async ({
	coalition,
}: {
	coalition?: string
} = {}): Promise<RankingPage> => {
	const firstPage = await fetchRankingPage({
		page: 1,
		perPage: RANKING_FETCH_PAGE_SIZE,
		coalition,
	})

	if (firstPage.totalPages <= 1) {
		return firstPage
	}

	const allUsers = [...firstPage.users]
	const remainingPages: number[] = []
	for (let page = 2; page <= firstPage.totalPages; page += 1) {
		remainingPages.push(page)
	}

	for (let index = 0; index < remainingPages.length; index += RANKING_PARALLEL_REQUESTS) {
		const pageBatch = remainingPages.slice(index, index + RANKING_PARALLEL_REQUESTS)
		const batchResults = await Promise.all(
			pageBatch.map((page) =>
				fetchRankingPage({
					page,
					perPage: RANKING_FETCH_PAGE_SIZE,
					coalition,
				})
			)
		)

		for (const result of batchResults) {
			allUsers.push(...result.users)
		}
	}

	return {
		page: 1,
		perPage: allUsers.length || RANKING_FETCH_PAGE_SIZE,
		total: firstPage.total,
		totalPages: 1,
		users: allUsers,
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
