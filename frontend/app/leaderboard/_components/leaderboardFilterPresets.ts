export interface LeaderboardFilterPreset {
	id: string
	name: string
	search: string
	selectedCoalitions: string[]
	levelMin: number
	levelMax: number
	pointsMin: number
	pointsMax: number
}

export const demoFilterPresets: LeaderboardFilterPreset[] = [
	{
		id: 'demo-top-level',
		name: 'Top nivel',
		search: '',
		selectedCoalitions: [],
		levelMin: 12,
		levelMax: 25,
		pointsMin: 15000,
		pointsMax: 500000,
	},
	{
		id: 'demo-beginners',
		name: 'Nuevos activos',
		search: '',
		selectedCoalitions: [],
		levelMin: 0,
		levelMax: 6,
		pointsMin: 1000,
		pointsMax: 80000,
	},
]