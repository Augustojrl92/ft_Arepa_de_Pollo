import type { Achievement, Ally, IncomingAllyRequest, ProfilePreferences, RankingPerPage } from './types'

export const allowedPerPage: RankingPerPage[] = [10, 25, 50, 100]

export const defaultPreferences: ProfilePreferences = {
	rankingPerPage: 25,
	showSensitiveData: true,
	notificationsEnabled: true,
	theme: 'system',
}

export const mockAllies: Ally[] = [
	{
		login: 'aurodrig',
		coalition: 'Zefiria',
		level: 9,
		avatar: 'https://cdn.intra.42.fr/users/662610d79d28c342034ad8108c599e22/aurodrig.JPG',
		online: true,
	},
	{
		login: 'fmorenil',
		coalition: 'Tiamant',
		level: 8,
		avatar: 'https://cdn.intra.42.fr/users/8c15635e4686871ef01a5410d9b59599/fmorenil.JPG',
		online: true,
	}
]

export const mockIncomingRequests: IncomingAllyRequest[] = [
	{
		id: 'req-1',
		login: 'layala-s',
		coalition: 'Ignisaria',
		level: 6,
		avatar: 'https://cdn.intra.42.fr/users/519fc4ea4570d9b2aa689b904090aa11/layala-s.JPG',
	},
	{
		id: 'req-2',
		login: 'fvizcaya',
		coalition: 'Tiamant',
		level: 6,
		avatar: 'https://cdn.intra.42.fr/users/522f8aff76fbda9faee250ae46e2bc18/fvizcaya.JPG',
	},
]

export const mockAchievements: Achievement[] = [
	{
		title: 'Bienvenido a AEDLPH',
		description: 'Inicia sesión por primera vez en AEDLPH',
		completed: true,
		completionDate: '2024-06-01',
		progress: 100,
		icon: 'medal',
	},
	{
		title: 'Corazón de coalición',
		description: 'Alcanza los 10,000 puntos de coalición.',
		completed: true,
		completionDate: '2024-06-01',
		progress: 100,
		icon: 'rocket',
	},
	{
		title: 'Confianza blindada',
		description: 'Haz 100 o más evaluaciones durante una temporada de torneo de coaliciones',
		completed: false,
		progress: 45,
		icon: 'shield',
	},
	{
		title: 'Gladiador de la arena',
		description: 'Has terminado en el top 10 del ranking de 42 Madrid durante una temporada de torneo de coaliciones',
		completed: false,
		progress: 65,
		icon: 'swords',
	},
]

