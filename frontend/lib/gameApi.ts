import { authFetchJson } from './authApi'
import { RpslsChoice } from './rpsls'

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const GAME_BASE_URL = `${API_URL}/api/games/matches`

export type GamePlayer = {
	user_id: number
	login: string
	display_name: string
	avatar_url: string
}

export type MultiplayerRound = {
	number: number
	inviter_choice: RpslsChoice
	opponent_choice: RpslsChoice
	winner_user_id: number | null
	verb: string
}

export type MultiplayerMatch = {
	id: number
	status: 'pending' | 'active' | 'declined' | 'cancelled' | 'completed'
	target_score: 3 | 5
	inviter: GamePlayer
	opponent: GamePlayer
	inviter_score: number
	opponent_score: number
	winner_user_id: number | null
	role: 'inviter' | 'opponent'
	inviter_busy: boolean
	opponent_busy: boolean
	current_round: {
		number: number
		choice_submitted: boolean
		opponent_choice_submitted: boolean
	} | null
	rounds: MultiplayerRound[]
	created_at: string
	updated_at: string
}

export type MatchList = {
	incoming: MultiplayerMatch[]
	outgoing: MultiplayerMatch[]
	active: MultiplayerMatch[]
	recent: MultiplayerMatch[]
}

export function fetchMatches(): Promise<MatchList> {
	return authFetchJson<MatchList>(`${GAME_BASE_URL}/`, { method: 'GET' }, 'No se pudieron cargar las partidas')
}

export function createMatchInvitation(opponentLogin: string, targetScore: 3 | 5): Promise<MultiplayerMatch> {
	return authFetchJson<MultiplayerMatch>(`${GAME_BASE_URL}/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ opponent_login: opponentLogin, target_score: targetScore }),
	}, 'No se pudo enviar la invitacion')
}

export function updateMatchInvitation(matchId: number, action: 'accept' | 'decline' | 'cancel' | 'forfeit'): Promise<MultiplayerMatch> {
	return authFetchJson<MultiplayerMatch>(`${GAME_BASE_URL}/${matchId}/`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action }),
	}, 'No se pudo actualizar la invitacion')
}

export function submitMatchMove(matchId: number, choice: RpslsChoice): Promise<MultiplayerMatch> {
	return authFetchJson<MultiplayerMatch>(`${GAME_BASE_URL}/${matchId}/move/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ choice }),
	}, 'No se pudo enviar la jugada')
}

export function requestRematch(matchId: number): Promise<MultiplayerMatch> {
	return authFetchJson<MultiplayerMatch>(`${GAME_BASE_URL}/${matchId}/rematch/`, {
		method: 'POST',
	}, 'No se pudo solicitar la revancha')
}
