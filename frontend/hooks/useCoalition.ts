'use client'

import { create } from "zustand"
import { fetchCoalitions, fetchRanking, fetchCoalitionDetails } from "@/lib/coalitionApi"
import { Coalition, RankingEntry } from "@/types"

interface CoalitionState {
	coalitions: Coalition[]
	ranking: RankingEntry[]
	maxScore: number
	error: string | null
	getCoalitions: () => Promise<void>
	getRanking: () => Promise<void>
	getCoalitionDetails: (slug: string) => Promise<void>
	setError: (msg: string | null) => void
}

export const useCoalitionStore = create<CoalitionState>()(
	(set) => ({
		coalitions: [],
		ranking: [],
		maxScore: 0,
		error: null,

		getCoalitions: async () => {
			try {
				const coalitions = await fetchCoalitions()
				const maxScore = coalitions.length > 0 ? Math.max(...coalitions.map(c => c.score)) : 0

				set({ coalitions, maxScore, error: null })
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to fetch coalitions"
				
				set({ error: message })
			}
		},
		getRanking: async () => {
			try {
				const ranking = await fetchRanking()
				
				set({ ranking, error: null })
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
