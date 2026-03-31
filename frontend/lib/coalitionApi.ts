import { Coalition, RankingEntry } from "@/types"

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const COALITION_BASE_URL = `${API_URL}/api/coalitions/`

type ApiErrorPayload = {
	error?: string
	detail?: string
}

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
}

type RankingApiResponse = {
	users?: RankingApiItem[]
}

const getErrorMessage = async (response: Response, fallbackMessage: string) => {
	const payload = await response.json().catch(() => null) as ApiErrorPayload | null

	return payload?.error ?? payload?.detail ?? fallbackMessage
}

export const fetchCoalitions = async (): Promise<Coalition[]> => {
	const response = await fetch(COALITION_BASE_URL, {
		method: "GET",
		credentials: "include",
	})

	if (!response.ok) {
		throw new Error(await getErrorMessage(response, "Failed to fetch coalitions"))
	}

	const payload = await response.json() as CoalitionApiResponse
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

export const fetchRanking = async () => {
	const response = await fetch(`${COALITION_BASE_URL}users-ranking/`, {
		method: "GET",
		credentials: "include",
	})

	if (!response.ok) {
		throw new Error(await getErrorMessage(response, "Failed to fetch ranking"))
	}

	const payload = await response.json() as RankingApiResponse
	const ranking = payload.users ?? []

	return ranking.map((entry) => ({
		rank: entry.rank,
		login: entry.login,
		displayName: entry.display_name,
		avatar: entry.avatar_url,
		coalition: entry.coalition,
		coalitionPoints: entry.coalition_points,
		intraLevel: entry.intra_level,
	}))
}
