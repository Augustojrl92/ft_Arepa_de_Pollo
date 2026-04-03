import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore, useCoalitionStore } from '@/hooks'
import { useSearchParams } from 'next/navigation'
import { demoFilterPresets, type LeaderboardFilterPreset } from '../app/leaderboard/_components/leaderboardFilterPresets'

type SortField = 'rank' | 'coalition' | 'login' | 'intraLevel' | 'coalitionPoints'
type SortDirection = 'asc' | 'desc'
type FilterSnapshot = Omit<LeaderboardFilterPreset, 'id' | 'name'>

const levelUpperBound = 25



const normalizeSelectedCoalitions = (selectedCoalitions: string[]) => [...selectedCoalitions].sort()

const areSnapshotsEqual = (left: FilterSnapshot, right: FilterSnapshot) => {
	const leftCoalitions = normalizeSelectedCoalitions(left.selectedCoalitions)
	const rightCoalitions = normalizeSelectedCoalitions(right.selectedCoalitions)

	return (
		left.search === right.search &&
		left.levelMin === right.levelMin &&
		left.levelMax === right.levelMax &&
		left.pointsMin === right.pointsMin &&
		left.pointsMax === right.pointsMax &&
		leftCoalitions.length === rightCoalitions.length &&
		leftCoalitions.every((coalition, index) => coalition === rightCoalitions[index])
	)
}

const getInitialSelectedCoalitions = (searchParams: { get: (name: string) => string | null }) => {
	const coalitionFromQuery = searchParams.get('coalition')
	return coalitionFromQuery ? [coalitionFromQuery] : []
}

const getInitialLevelBounds = (searchParams: { get: (name: string) => string | null }) => {
	const minFromQuery = Number.parseInt(searchParams.get('levelMin') ?? '', 10)
	const maxFromQuery = Number.parseInt(searchParams.get('levelMax') ?? '', 10)
	const safeMin = Number.isNaN(minFromQuery)
		? 0
		: Math.max(0, Math.min(minFromQuery, levelUpperBound))
	const safeMax = Number.isNaN(maxFromQuery)
		? levelUpperBound
		: Math.max(0, Math.min(maxFromQuery, levelUpperBound))

	return {
		levelMin: Math.min(safeMin, safeMax),
		levelMax: Math.max(safeMin, safeMax),
	}
}

const getInitialPointsBounds = (
	searchParams: { get: (name: string) => string | null },
	defaultMin: number = 0,
	defaultMax: number = Number.MAX_SAFE_INTEGER
) => {
	const minFromQuery = Number.parseInt(searchParams.get('pointsMin') ?? '', 10)
	const maxFromQuery = Number.parseInt(searchParams.get('pointsMax') ?? '', 10)
	const safeMin = Number.isNaN(minFromQuery)
		? defaultMin
		: Math.max(0, Math.min(minFromQuery, defaultMax))
	const safeMax = Number.isNaN(maxFromQuery)
		? defaultMax
		: Math.max(0, Math.min(maxFromQuery, defaultMax))

	return {
		pointsMin: Math.min(safeMin, safeMax),
		pointsMax: Math.max(safeMin, safeMax),
	}
}

const compactNumberFormatter = new Intl.NumberFormat('es-ES', {
	minimumFractionDigits: 0,
	maximumFractionDigits: 1,
})

const formatLeaderboardNumber = (value: number) => {
	if (value > 1000000) {
		return `${compactNumberFormatter.format(value / 1000000)}M`
	}

	if (value > 1000) {
		return `${compactNumberFormatter.format(value / 1000)}K`
	}

	return value.toLocaleString('es-ES')
}

export const useLeaderboard = () => {
	const { coalitions, ranking, rankingMeta, isRankingLoading, getRanking } = useCoalitionStore()
	const { user } = useAuthStore()
	const searchParams = useSearchParams()
	const [search, setSearch] = useState('')
	const [selectedCoalitions, setSelectedCoalitions] = useState<string[]>(() =>
		getInitialSelectedCoalitions(searchParams)
	)
	const initialLevelBounds = getInitialLevelBounds(searchParams)
	const initialPointsBounds = getInitialPointsBounds(searchParams)
	const [levelMin, setLevelMin] = useState(initialLevelBounds.levelMin)
	const [levelMax, setLevelMax] = useState(initialLevelBounds.levelMax)
	const [pointsMin, setPointsMin] = useState(initialPointsBounds.pointsMin)
	const [pointsMax, setPointsMax] = useState(initialPointsBounds.pointsMax)
	const [savedFilterPresets, setSavedFilterPresets] = useState<LeaderboardFilterPreset[]>(demoFilterPresets)
	const [activePresetId, setActivePresetId] = useState<string | null>(null)
	const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
	const [editingPresetName, setEditingPresetName] = useState('')
	const [sortBy, setSortBy] = useState<SortField>('rank')
	const [sortDir, setSortDir] = useState<SortDirection>('asc')
	const [page, setPage] = useState(1)
	const [perPage, setPerPage] = useState(25)
	const [isRankInfoOpen, setIsRankInfoOpen] = useState(false)
	const rankInfoRef = useRef<HTMLDivElement | null>(null)

	const coalitionBySlug = useMemo(
		() => new Map(coalitions.map((coalition) => [coalition.slug, coalition])),
		[coalitions]
	)
	const liveMaxPointsLvl = useMemo(
		() => ranking.reduce((max, currentUser) => Math.max(max, currentUser.coalitionPoints), 0),
		[ranking]
	)
	const [frozenMaxPointsLvl, setFrozenMaxPointsLvl] = useState<number | null>(null)
	const maxPointsLvl = frozenMaxPointsLvl ?? liveMaxPointsLvl
	const safePointsMin = Math.min(pointsMin, maxPointsLvl)
	const safePointsMax = Math.max(safePointsMin, Math.min(pointsMax, maxPointsLvl))

	const serverCoalitionFilter = selectedCoalitions.length === 1 ? selectedCoalitions[0] : undefined

	useEffect(() => {
		void getRanking({
			coalition: serverCoalitionFilter,
		})
	}, [getRanking, serverCoalitionFilter])

	useEffect(() => {
		if (frozenMaxPointsLvl !== null) {
			return
		}

		if (ranking.length === 0) {
			return
		}

		setFrozenMaxPointsLvl(liveMaxPointsLvl)
	}, [frozenMaxPointsLvl, liveMaxPointsLvl, ranking.length])

	useEffect(() => {
		if (!editingPresetId) {
			setEditingPresetName('')
			return
		}

		const editingPreset = savedFilterPresets.find((preset) => preset.id === editingPresetId)
		setEditingPresetName(editingPreset?.name ?? '')
	}, [editingPresetId, savedFilterPresets])

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (!rankInfoRef.current) {
				return
			}

			if (!rankInfoRef.current.contains(event.target as Node)) {
				setIsRankInfoOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [])

	const handleCoalitionToggle = (slug: string) => {
		setPage(1)
		setSelectedCoalitions((current) =>
			current.includes(slug)
				? current.filter((item) => item !== slug)
				: [...current, slug]
		)
	}

	const clearFilters = () => {
		setSearch('')
		setSelectedCoalitions([])
		setLevelMin(0)
		setLevelMax(levelUpperBound)
		setPointsMin(0)
		setPointsMax(maxPointsLvl)
		setActivePresetId(null)
		setEditingPresetId(null)
		setEditingPresetName('')
		setSortBy('rank')
		setSortDir('asc')
		setPage(1)
	}

	const getCurrentPresetSnapshot = (): FilterSnapshot => ({
		search,
		selectedCoalitions,
		levelMin,
		levelMax,
		pointsMin: safePointsMin,
		pointsMax: safePointsMax,
	})

	const getPresetSnapshot = (preset: LeaderboardFilterPreset): FilterSnapshot => {
		const clampedLevelMin = Math.max(0, Math.min(preset.levelMin, levelUpperBound))
		const clampedLevelMax = Math.max(clampedLevelMin, Math.min(preset.levelMax, levelUpperBound))
		const clampedPointsMin = Math.max(0, Math.min(preset.pointsMin, maxPointsLvl))
		const clampedPointsMax = Math.max(clampedPointsMin, Math.min(preset.pointsMax, maxPointsLvl))

		return {
			search: preset.search,
			selectedCoalitions: preset.selectedCoalitions,
			levelMin: clampedLevelMin,
			levelMax: clampedLevelMax,
			pointsMin: clampedPointsMin,
			pointsMax: clampedPointsMax,
		}
	}

	const applyPreset = (preset: LeaderboardFilterPreset) => {
		const clampedLevelMin = Math.max(0, Math.min(preset.levelMin, levelUpperBound))
		const clampedLevelMax = Math.max(clampedLevelMin, Math.min(preset.levelMax, levelUpperBound))
		const clampedPointsMin = Math.max(0, Math.min(preset.pointsMin, maxPointsLvl))
		const clampedPointsMax = Math.max(clampedPointsMin, Math.min(preset.pointsMax, maxPointsLvl))

		setSearch(preset.search)
		setSelectedCoalitions(preset.selectedCoalitions)
		setLevelMin(clampedLevelMin)
		setLevelMax(clampedLevelMax)
		setPointsMin(clampedPointsMin)
		setPointsMax(clampedPointsMax)
		setActivePresetId(preset.id)
		setEditingPresetId(null)
		setPage(1)
	}

	const togglePreset = (preset: LeaderboardFilterPreset) => {
		if (activePresetId === preset.id) {
			clearFilters()
			return
		}

		applyPreset(preset)
	}

	const startEditPreset = (presetId: string) => {
		const presetToEdit = savedFilterPresets.find((preset) => preset.id === presetId)
		if (!presetToEdit) {
			return
		}

		const clampedLevelMin = Math.max(0, Math.min(presetToEdit.levelMin, levelUpperBound))
		const clampedLevelMax = Math.max(clampedLevelMin, Math.min(presetToEdit.levelMax, levelUpperBound))
		const clampedPointsMin = Math.max(0, Math.min(presetToEdit.pointsMin, maxPointsLvl))
		const clampedPointsMax = Math.max(clampedPointsMin, Math.min(presetToEdit.pointsMax, maxPointsLvl))

		setSearch(presetToEdit.search)
		setSelectedCoalitions(presetToEdit.selectedCoalitions)
		setLevelMin(clampedLevelMin)
		setLevelMax(clampedLevelMax)
		setPointsMin(clampedPointsMin)
		setPointsMax(clampedPointsMax)
		setActivePresetId(presetId)
		setEditingPresetId(presetId)
		setEditingPresetName(presetToEdit.name)
		setPage(1)
	}

	const createPresetFromCurrentFilters = () => {
		const nextNumber = savedFilterPresets.length + 1
		const presetId = `custom-${Date.now()}`
		const nextPreset: LeaderboardFilterPreset = {
			id: presetId,
			name: `Filtro ${nextNumber}`,
			...getCurrentPresetSnapshot(),
		}

		setSavedFilterPresets((current) => [...current, nextPreset])
		setActivePresetId(presetId)
	}

	const updatePresetFromCurrentFilters = (presetId: string) => {
		const snapshot = getCurrentPresetSnapshot()
		const safeName = editingPresetName.trim().length > 0 ? editingPresetName.trim() : 'Filtro personalizado'
		setSavedFilterPresets((current) =>
			current.map((preset) =>
				preset.id === presetId
					? {
						...preset,
						name: safeName,
						...snapshot,
					}
					: preset
			)
		)
		setActivePresetId(presetId)
		setEditingPresetId(null)
		setEditingPresetName('')
	}

	const deletePreset = (presetId: string) => {
		setSavedFilterPresets((current) => current.filter((preset) => preset.id !== presetId))
		if (activePresetId === presetId) {
			setActivePresetId(null)
		}
		if (editingPresetId === presetId) {
			setEditingPresetId(null)
			setEditingPresetName('')
		}
	}

	const handleSort = (field: SortField) => {
		setPage(1)
		if (sortBy === field) {
			setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
			return
		}
		setSortBy(field)
		setSortDir('asc')
	}

	const handleSearchChange = (value: string) => {
		setSearch(value)
		if (!editingPresetId) {
			setActivePresetId(null)
		}
		setPage(1)
	}

	const handleLevelMinChange = (value: number) => {
		setLevelMin(value)
		if (!editingPresetId) {
			setActivePresetId(null)
		}
		setPage(1)
	}

	const handleLevelMaxChange = (value: number) => {
		setLevelMax(value)
		if (!editingPresetId) {
			setActivePresetId(null)
		}
		setPage(1)
	}

	const handlePointsMinChange = (value: number) => {
		setPointsMin(value)
		if (!editingPresetId) {
			setActivePresetId(null)
		}
		setPage(1)
	}

	const handlePointsMaxChange = (value: number) => {
		setPointsMax(value)
		if (!editingPresetId) {
			setActivePresetId(null)
		}
		setPage(1)
	}

	const handlePerPageChange = (value: number) => {
		setPerPage(value)
		setPage(1)
	}

	const filtered = ranking.filter((campusUser) => {
		const passSearch =
			search.trim().length === 0 ||
			campusUser.login.toLowerCase().includes(search.toLowerCase()) ||
			campusUser.displayName.toLowerCase().includes(search.toLowerCase())

		const passCoalition =
			selectedCoalitions.length === 0 || selectedCoalitions.includes(campusUser.coalition)

		const passLevel = campusUser.intraLevel >= levelMin && campusUser.intraLevel <= levelMax
		const passPoints = campusUser.coalitionPoints >= safePointsMin && campusUser.coalitionPoints <= safePointsMax

		return passSearch && passCoalition && passLevel && passPoints
	})

	const sorted = [...filtered].sort((leftUser, rightUser) => {
		const valueA = leftUser[sortBy]
		const valueB = rightUser[sortBy]

		if (typeof valueA === 'string' && typeof valueB === 'string') {
			return sortDir === 'asc'
				? valueA.localeCompare(valueB)
				: valueB.localeCompare(valueA)
		}

		return sortDir === 'asc'
			? (valueA as number) - (valueB as number)
			: (valueB as number) - (valueA as number)
	})

	const localTotalPages = Math.max(Math.ceil(sorted.length / perPage), 1)
	const safePage = Math.min(page, localTotalPages)
	const paginated = sorted.slice((safePage - 1) * perPage, safePage * perPage)
	const hasAppliedFilters =
		search.trim().length > 0 ||
		selectedCoalitions.length > 0 ||
		levelMin > 0 ||
		levelMax < levelUpperBound ||
		safePointsMin > 0 ||
		safePointsMax < maxPointsLvl
	const currentSnapshot = getCurrentPresetSnapshot()
	const defaultSnapshot: FilterSnapshot = {
		search: '',
		selectedCoalitions: [],
		levelMin: 0,
		levelMax: levelUpperBound,
		pointsMin: 0,
		pointsMax: maxPointsLvl,
	}
	const isModifiedFromDefault = !areSnapshotsEqual(currentSnapshot, defaultSnapshot)
	const matchedPresetId = savedFilterPresets.find((preset) =>
		areSnapshotsEqual(currentSnapshot, getPresetSnapshot(preset))
	)?.id ?? null
	const showCreatePresetButton = isModifiedFromDefault && !editingPresetId && !matchedPresetId
	const editingPreset = editingPresetId
		? savedFilterPresets.find((preset) => preset.id === editingPresetId)
		: null
	const isEditingPresetModified = editingPreset
		? !areSnapshotsEqual(currentSnapshot, getPresetSnapshot(editingPreset))
		: false
	const matchesAnotherPreset = editingPresetId
		? savedFilterPresets.some(
			(preset) => preset.id !== editingPresetId && areSnapshotsEqual(currentSnapshot, getPresetSnapshot(preset))
		)
		: false
	const showUpdatePresetButton = Boolean(editingPresetId && isEditingPresetModified && !matchesAnotherPreset)
	const hasLocalFilters = hasAppliedFilters
	const usersRangeStart = sorted.length === 0 ? 0 : ((safePage - 1) * perPage) + 1
	const usersRangeEnd = sorted.length === 0 ? 0 : Math.min(safePage * perPage, sorted.length)

	const totalPoints = sorted.reduce((sum, campusUser) => sum + campusUser.coalitionPoints, 0)
	const avgLevel =
		sorted.length > 0
			? sorted.reduce((sum, campusUser) => sum + campusUser.intraLevel, 0) / sorted.length
			: 0
	const userCoalition = coalitions.find((coalition) => coalition.slug === user?.coalition)

	return {
		activePresetId,
		avgLevel,
		clearFilters,
		coalitionBySlug,
		coalitions,
		createPresetFromCurrentFilters,
		deletePreset,
		editingPresetId,
		editingPresetName,
		formatLeaderboardNumber,
		handleCoalitionToggle,
		handleLevelMaxChange,
		handleLevelMinChange,
		handlePerPageChange,
		handlePointsMaxChange,
		handlePointsMinChange,
		handleSearchChange,
		handleSort,
		hasAppliedFilters,
		hasLocalFilters,
		isRankInfoOpen,
		isRankingLoading,
		levelMax,
		levelMin,
		levelUpperBound,
		localTotalPages,
		maxPointsLvl,
		paginated,
		perPage,
		pointsMax: safePointsMax,
		pointsMin: safePointsMin,
		rankInfoRef,
		ranking,
		rankingMeta,
		safePage,
		savedFilterPresets,
		search,
		selectedCoalitions,
		setEditingPresetName,
		setIsRankInfoOpen,
		setPage,
		showCreatePresetButton,
		showUpdatePresetButton,
		sortBy,
		sortDir,
		sorted,
		togglePreset,
		totalPoints,
		updatePresetFromCurrentFilters,
		user,
		userCoalition,
		usersRangeEnd,
		usersRangeStart,
		startEditPreset,
	}
}
