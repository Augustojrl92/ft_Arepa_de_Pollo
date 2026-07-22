import { PointsHistoryEntry } from "@/types"

type ChartRange = 'weekly' | 'monthly' | 'cumulative'

type ChartPoint = {
	date: string
	label: string
	points: number
}

const parseIsoDate = (value: string) => {
	const [year, month, day] = value.split('-').map(Number)
	return new Date(year, (month ?? 1) - 1, day ?? 1)
}

const formatLabel = (date: Date, range: ChartRange) => {
	if (range === 'cumulative') {
		return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
	}

	return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

export const buildChartPoints = (history: PointsHistoryEntry[], range: ChartRange): ChartPoint[] => {
	if (history.length === 0) {
		return []
	}

	const limitDays = range === 'weekly' ? 7 : range === 'monthly' ? 30 : null
	const source = limitDays === null ? history : history.slice(-limitDays)

	return source.map((entry) => {
		const date = parseIsoDate(entry.date)
		return {
			date: entry.date,
			label: formatLabel(date, range),
			points: entry.points,
		}
	})
}
