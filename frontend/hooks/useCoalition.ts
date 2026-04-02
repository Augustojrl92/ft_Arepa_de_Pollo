'use client'

import { create } from "zustand"
import { fetchCoalitions, fetchRanking, fetchCoalitionDetails } from "@/lib/coalitionApi"
import { Coalition, RankingEntry, RankingPage } from "@/types"

interface CoalitionState {
	coalitions: Coalition[]
	ranking: RankingEntry[]
	rankingMeta: Omit<RankingPage, "users">
	maxScore: number
	error: string | null
	lastUpdate: string | null
	getCoalitions: () => Promise<void>
	getRanking: (options?: { page?: number; perPage?: number; coalition?: string }) => Promise<void>
	getCoalitionDetails: (slug: string) => Promise<void>
	setError: (msg: string | null) => void
}

const formatLastUpdateDiff = (updatedAt: string | null): string | null => {
	if (!updatedAt) return null

	const now = Date.now()
	const updated = new Date(updatedAt).getTime()
	const diffMs = now - updated

	if (diffMs < 60_000) return "hace unos segundos"

	const minutes = Math.floor(diffMs / 60_000)
	if (minutes < 60) return `hace ${minutes} min`

	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `hace ${hours} h`

	const days = Math.floor(hours / 24)
	return `hace ${days} d`
}

export const useCoalitionStore = create<CoalitionState>()(
	(set) => ({
		coalitions: [],
		ranking: [],
		rankingMeta: {
			page: 1,
			perPage: 30,
			total: 0,
			totalPages: 0,
		},
		maxScore: 0,
		error: null,
		lastUpdate: null,

		getCoalitions: async () => {
			try {
				const { coalitions, lastUpdate } = await fetchCoalitions()
				const maxScore = coalitions.length > 0 ? Math.max(...coalitions.map(c => c.score)) : 0
				const lastUpdateFormatted = formatLastUpdateDiff(lastUpdate)

				set({ coalitions, maxScore, error: null, lastUpdate: lastUpdateFormatted })
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to fetch coalitions"

				set({ error: message })
			}
		},
		getRanking: async (options = {}) => {
			try {
				const rankingPage = await fetchRanking(options)
				
				set({
					ranking: rankingPage.users,
					rankingMeta: {
						page: rankingPage.page,
						perPage: rankingPage.perPage,
						total: rankingPage.total,
						totalPages: rankingPage.totalPages,
					},
					error: null,
				})
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to fetch ranking"

				set({ error: message })
			}
		},
		getCoalitionDetails: async (slug: string) => {
			try {
				const details = await fetchCoalitionDetails(slug)

				set((state) => ({
					coalitions: state.coalitions.map((coalition) =>
						coalition.slug === slug ? { ...coalition, details } : coalition
					),
					error: null,
				}))
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to fetch coalition details"

				set({ error: message })
			}
		},
		setError: (msg) => set({ error: msg })
	})
)
