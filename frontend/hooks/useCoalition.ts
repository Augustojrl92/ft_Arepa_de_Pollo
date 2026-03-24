'use client'

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getCoalitions } from "@/lib/coalitionApi";
import { Coalition } from "@/types";


interface CoalitionState {
	coalitions: Coalition[];
	maxScore: number;
	error: string | null;
	hasHydrated: boolean;

	setCoalitions: () => Promise<void>;
	setError: (msg: string | null) => void;
	setHasHydrated: (value: boolean) => void;
}

export const useCoalitionStore = create<CoalitionState>()(
	persist(
		(set) => ({
			coalitions: [],
			maxScore: 0,
			error: null,
			hasHydrated: false,

			setCoalitions: async () => {
				try {
					const coalitions = await getCoalitions();
					const maxScore = Math.max(...coalitions.map(c => c.score));
					set({ coalitions, maxScore, error: null });
				} catch (error) {
					const message = error instanceof Error ? error.message : "Failed to fetch coalitions";
					set({ error: message });
				}
			},
			setError: (msg) => set({ error: msg }),
			setHasHydrated: (value) => set({ hasHydrated: value }),
		}),
		{
			name: "coalition-store",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				coalitions: state.coalitions,
				maxScore: state.maxScore,
			}),
			onRehydrateStorage: () => (state) => {
				state?.setHasHydrated(true);
			},
		}
	)
);