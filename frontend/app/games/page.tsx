'use client'

import {
	CheckIcon,
	Clock3Icon,
	Gamepad2Icon,
	HistoryIcon,
	RefreshCwIcon,
	RotateCcwIcon,
	ScaleIcon,
	SwordsIcon,
	TrophyIcon,
	UserPlusIcon,
	UsersIcon,
	XIcon,
} from 'lucide-react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuthStore } from '@/hooks/useAuth'
import {
	createMatchInvitation,
	fetchMatches,
	MatchList,
	MultiplayerMatch,
	requestRematch,
	resolveRematch,
	submitMatchMove,
	updateMatchInvitation,
} from '@/lib/gameApi'
import { GameSocketStatus, subscribeGameSocket } from '@/lib/gameSocket'
import {
	CHOICE_DETAILS,
	RPSLS_CHOICES,
	RpslsChoice,
	RpslsResult,
	WINNING_RELATIONS,
	randomRpslsChoice,
	resolveRpslsRound,
} from '@/lib/rpsls'
import { fetchMyFriends } from '@/lib/userApi'
import { FriendEntry } from '@/types'

type MatchTarget = 0 | 3 | 5
type GameView = 'solo' | 'friends'

type Round = {
	id: number
	player: RpslsChoice
	opponent: RpslsChoice
	result: RpslsResult
	verb: string
}

type SavedGame = {
	playerScore: number
	cpuScore: number
	ties: number
	target: MatchTarget
	history: Round[]
}

const STORAGE_KEY = 'aedlph.rpsls.game'
const EMPTY_GAME: SavedGame = { playerScore: 0, cpuScore: 0, ties: 0, target: 3, history: [] }
const EMPTY_MATCHES: MatchList = { incoming: [], outgoing: [], active: [], recent: [], rematch_incoming: [], rematch_outgoing: [] }

const resultCopy: Record<RpslsResult, string> = {
	win: 'Ronda ganada',
	loss: 'Ronda perdida',
	tie: 'Empate',
}

function isRpslsChoice(value: unknown): value is RpslsChoice {
	return typeof value === 'string' && RPSLS_CHOICES.includes(value as RpslsChoice)
}

function normalizeSavedGame(value: unknown): SavedGame {
	if (!value || typeof value !== 'object') return EMPTY_GAME
	const saved = value as Record<string, unknown>
	const target = saved.target === 0 || saved.target === 3 || saved.target === 5 ? saved.target : 3
	const score = (candidate: unknown) =>
		typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 ? candidate : 0
	const history = Array.isArray(saved.history)
		? saved.history.flatMap((entry, index): Round[] => {
			if (!entry || typeof entry !== 'object') return []
			const round = entry as Record<string, unknown>
			const player = round.player
			const opponent = round.opponent ?? round.cpu
			const result = round.result
			if (!isRpslsChoice(player) || !isRpslsChoice(opponent) || !['win', 'loss', 'tie'].includes(String(result))) return []
			return [{
				id: typeof round.id === 'number' ? round.id : Date.now() + index,
				player,
				opponent,
				result: result as RpslsResult,
				verb: typeof round.verb === 'string' ? round.verb : 'vence a',
			}]
		})
		: []

	return {
		playerScore: score(saved.playerScore),
		cpuScore: score(saved.cpuScore),
		ties: score(saved.ties),
		target,
		history,
	}
}

function relationCopy(round: Round) {
	const playerDetails = CHOICE_DETAILS[round.player]
	const opponentDetails = CHOICE_DETAILS[round.opponent]
	if (!playerDetails || !opponentDetails) return 'Ronda anterior no disponible'
	if (round.result === 'tie') return `${playerDetails.label} empata con ${opponentDetails.label}`
	const winner = round.result === 'win' ? round.player : round.opponent
	const loser = round.result === 'win' ? round.opponent : round.player
	return `${CHOICE_DETAILS[winner].label} ${round.verb} ${CHOICE_DETAILS[loser].label}`
}

function RulesPanel() {
	return (
		<section className="game-panel" aria-labelledby="rules-title">
			<h2 id="rules-title"><ScaleIcon size={18} /> Reglas</h2>
			<ul className="game-rules">
				{WINNING_RELATIONS.map((relation) => (
					<li key={`${relation.winner}-${relation.loser}`}>
						<span>{CHOICE_DETAILS[relation.winner].symbol}</span>
						<p><strong>{CHOICE_DETAILS[relation.winner].label}</strong> {relation.verb} {CHOICE_DETAILS[relation.loser].label}</p>
						<span>{CHOICE_DETAILS[relation.loser].symbol}</span>
					</li>
				))}
			</ul>
		</section>
	)
}

function WinnerPanel({ title, score, onRematch, onReload, pending = false }: {
	title: string
	score: string
	onRematch: () => void
	onReload: () => void
	pending?: boolean
}) {
	return (
		<section className="game-winner-panel" role="status" aria-live="polite" aria-labelledby="game-winner-title">
			<div className="game-winner-trophy"><TrophyIcon size={30} /></div>
			<div className="game-winner-copy">
				<p>Partida finalizada</p>
				<h2 id="game-winner-title">{title}</h2>
				<strong>{score}</strong>
			</div>
			<div className="game-winner-actions">
				<button type="button" onClick={onRematch} disabled={pending}>
					<RotateCcwIcon size={18} /> {pending ? 'Invitacion enviada' : 'Revancha'}
				</button>
				<button type="button" className="is-secondary" onClick={onReload}>
					<RefreshCwIcon size={18} /> Recargar pagina
				</button>
			</div>
		</section>
	)
}

function MultiplayerWinnerPanel({ match, currentUserId, rivalLogin, title, score, busy, onRequest, onResolve, onExit }: {
	match: MultiplayerMatch
	currentUserId: number
	rivalLogin: string
	title: string
	score: string
	busy: boolean
	onRequest: () => void
	onResolve: (action: 'accept' | 'reject' | 'cancel') => void
	onExit: () => void
}) {
	const pending = match.rematch_status === 'pending'
	const requestedByMe = match.rematch_requested_by_user_id === currentUserId
	const accepted = match.rematch_status === 'accepted'

	return (
		<section className="game-winner-panel" role="status" aria-live="polite" aria-labelledby="multiplayer-winner-title">
			<div className="game-winner-trophy"><TrophyIcon size={30} /></div>
			<div className="game-winner-copy">
				<p>{pending ? requestedByMe ? 'Revancha solicitada' : `${rivalLogin} quiere la revancha` : accepted ? 'Preparando revancha' : 'Partida finalizada'}</p>
				<h2 id="multiplayer-winner-title">{title}</h2>
				<strong>{score}</strong>
			</div>
			<div className="game-winner-actions">
				{pending && requestedByMe ? (
					<button type="button" onClick={() => onResolve('cancel')} disabled={busy}>
						<XIcon size={18} /> Cancelar solicitud
					</button>
				) : pending ? (
					<>
						<button type="button" onClick={() => onResolve('accept')} disabled={busy} title="Aceptar revancha">
							<CheckIcon size={18} /> Aceptar
						</button>
						<button type="button" className="is-secondary" onClick={() => onResolve('reject')} disabled={busy} title="Rechazar revancha">
							<XIcon size={18} /> Rechazar
						</button>
					</>
				) : accepted ? (
					<button type="button" disabled><RotateCcwIcon size={18} /> Iniciando partida</button>
				) : (
					<button type="button" onClick={onRequest} disabled={busy}>
						<RotateCcwIcon size={18} /> Revancha
					</button>
				)}
				<button type="button" className="is-secondary" onClick={onExit} disabled={busy}>
					<RefreshCwIcon size={18} /> Recargar
				</button>
			</div>
		</section>
	)
}

function SoloGame() {
	const [game, setGame] = useState<SavedGame>(EMPTY_GAME)
	const [playerChoice, setPlayerChoice] = useState<RpslsChoice | null>(null)
	const [cpuChoice, setCpuChoice] = useState<RpslsChoice | null>(null)
	const [roundResult, setRoundResult] = useState<RpslsResult | null>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [hasHydrated, setHasHydrated] = useState(false)
	const playingRef = useRef(false)

	useEffect(() => {
		try {
			const saved = window.localStorage.getItem(STORAGE_KEY)
			if (saved) setGame(normalizeSavedGame(JSON.parse(saved)))
		} catch {
			window.localStorage.removeItem(STORAGE_KEY)
		}
		setHasHydrated(true)
	}, [])

	useEffect(() => {
		if (hasHydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game))
	}, [game, hasHydrated])

	const matchWinner = useMemo(() => {
		if (!game.target) return null
		if (game.playerScore >= game.target) return 'player'
		if (game.cpuScore >= game.target) return 'cpu'
		return null
	}, [game.cpuScore, game.playerScore, game.target])

	const resetMatch = (target = game.target) => {
		if (playingRef.current) return
		setGame({ playerScore: 0, cpuScore: 0, ties: 0, target, history: [] })
		setPlayerChoice(null)
		setCpuChoice(null)
		setRoundResult(null)
		setIsPlaying(false)
	}

	const playRound = async (choice: RpslsChoice) => {
		if (playingRef.current || matchWinner) return
		playingRef.current = true
		setIsPlaying(true)
		setPlayerChoice(choice)
		setCpuChoice(null)
		setRoundResult(null)
		const computer = randomRpslsChoice()
		await new Promise((resolve) => window.setTimeout(resolve, 550))
		const resolution = await resolveRpslsRound(choice, computer)
		setCpuChoice(computer)
		setRoundResult(resolution.result)
		setGame((current) => ({
			...current,
			playerScore: current.playerScore + (resolution.result === 'win' ? 1 : 0),
			cpuScore: current.cpuScore + (resolution.result === 'loss' ? 1 : 0),
			ties: current.ties + (resolution.result === 'tie' ? 1 : 0),
			history: [{ id: Date.now(), player: choice, opponent: computer, result: resolution.result, verb: resolution.verb }, ...current.history].slice(0, 12),
		}))
		playingRef.current = false
		setIsPlaying(false)
	}

	return (
		<>
			<div className="games-titlebar games-subtitlebar">
				<div><p className="games-eyebrow">Modo local</p><h2>Contra la CPU</h2></div>
				<button type="button" className="game-icon-command" disabled={isPlaying} onClick={() => resetMatch()} title="Reiniciar partida" aria-label="Reiniciar partida"><RotateCcwIcon size={19} /></button>
			</div>
			<div className="game-mode" aria-label="Modo de partida">
				{([3, 5, 0] as MatchTarget[]).map((target) => (
					<button key={target} type="button" disabled={isPlaying} className={game.target === target ? 'is-active' : ''} onClick={() => resetMatch(target)}>{target ? `Primero a ${target}` : 'Libre'}</button>
				))}
			</div>
			<div className="game-score" aria-label="Marcador">
				<div><span>Tu</span><strong>{game.playerScore}</strong></div>
				<div><span>Empates</span><strong>{game.ties}</strong></div>
				<div><span>CPU</span><strong>{game.cpuScore}</strong></div>
			</div>
			<div className="game-arena" aria-live="polite">
				<div className="game-player-choice"><span>Tu eleccion</span><div>{playerChoice ? CHOICE_DETAILS[playerChoice].symbol : '·'}</div><strong>{playerChoice ? CHOICE_DETAILS[playerChoice].label : 'Elige una opcion'}</strong></div>
				<div className={`game-result ${roundResult ? `is-${roundResult}` : ''}`}>
					{matchWinner ? <><TrophyIcon size={28} /><strong>Partida finalizada</strong></> : isPlaying ? <><ScaleIcon size={28} className="game-thinking" /><strong>La CPU esta eligiendo</strong></> : roundResult ? <><ScaleIcon size={28} /><strong>{resultCopy[roundResult]}</strong></> : <><ScaleIcon size={28} /><strong>Preparado</strong></>}
				</div>
				<div className="game-player-choice"><span>CPU</span><div>{cpuChoice ? CHOICE_DETAILS[cpuChoice].symbol : isPlaying ? '?' : '·'}</div><strong>{cpuChoice ? CHOICE_DETAILS[cpuChoice].label : 'Esperando'}</strong></div>
			</div>
			{matchWinner
				? <WinnerPanel title={matchWinner === 'player' ? 'Has ganado' : 'La CPU ha ganado'} score={`${game.playerScore} - ${game.cpuScore}`} onRematch={() => resetMatch()} onReload={() => window.location.reload()} />
				: <ChoiceButtons disabled={isPlaying} selected={playerChoice} onChoice={(choice) => void playRound(choice)} />}
			<div className="games-detail-grid">
				<section className="game-panel" aria-labelledby="history-title">
					<h2 id="history-title"><HistoryIcon size={18} /> Historial</h2>
					{game.history.length === 0 ? <p className="game-panel-empty">La primera ronda aparecera aqui.</p> : <ol className="game-history">{game.history.slice(0, 8).map((round) => <li key={round.id}><span className={`game-history-result is-${round.result}`}>{round.result === 'win' ? 'Victoria' : round.result === 'loss' ? 'Derrota' : 'Empate'}</span><p>{relationCopy(round)}</p><span>{CHOICE_DETAILS[round.player].symbol} · {CHOICE_DETAILS[round.opponent].symbol}</span></li>)}</ol>}
				</section>
				<RulesPanel />
			</div>
		</>
	)
}

function ChoiceButtons({ disabled, selected, onChoice }: { disabled: boolean; selected: RpslsChoice | null; onChoice: (choice: RpslsChoice) => void }) {
	return <div className="game-choices" aria-label="Elige tu jugada">{RPSLS_CHOICES.map((choice) => <button key={choice} type="button" disabled={disabled} className={selected === choice ? 'is-selected' : ''} onClick={() => onChoice(choice)}><span aria-hidden="true">{CHOICE_DETAILS[choice].symbol}</span><strong>{CHOICE_DETAILS[choice].label}</strong></button>)}</div>
}

function GameLiveStatus({ status }: { status: GameSocketStatus }) {
	const labels: Record<GameSocketStatus, string> = {
		connecting: 'Conectando',
		connected: 'Tiempo real',
		reconnecting: 'Reconectando',
		disconnected: 'Sin conexion',
	}
	return <span className={`game-live-badge is-${status}`}><span /> {labels[status]}</span>
}

function MultiplayerArena({ match, currentUserId, onMove, onRequestRematch, onResolveRematch, onExit, onForfeit, busy, socketStatus }: {
	match: MultiplayerMatch
	currentUserId: number
	onMove: (choice: RpslsChoice) => void
	onRequestRematch: () => void
	onResolveRematch: (action: 'accept' | 'reject' | 'cancel') => void
	onExit: () => void
	onForfeit: () => void
	busy: boolean
	socketStatus: GameSocketStatus
}) {
	const meIsInviter = match.inviter.user_id === currentUserId
	const me = meIsInviter ? match.inviter : match.opponent
	const rival = meIsInviter ? match.opponent : match.inviter
	const myScore = meIsInviter ? match.inviter_score : match.opponent_score
	const rivalScore = meIsInviter ? match.opponent_score : match.inviter_score
	const submitted = Boolean(match.current_round?.choice_submitted)
	const rivalSubmitted = Boolean(match.current_round?.opponent_choice_submitted)
	const latest = match.rounds[0]
	const myLatestChoice = latest ? (meIsInviter ? latest.inviter_choice : latest.opponent_choice) : null
	const rivalLatestChoice = latest ? (meIsInviter ? latest.opponent_choice : latest.inviter_choice) : null
	const result = latest?.winner_user_id === null ? 'tie' : latest?.winner_user_id === currentUserId ? 'win' : 'loss'
	const finished = match.status === 'completed'

	return (
		<>
			<div className="games-titlebar games-subtitlebar">
				<div><p className="games-eyebrow"><SwordsIcon size={15} /> Partida #{match.id}</p><h2>{me.login} vs {rival.login}</h2></div>
				<div className="game-match-commands"><GameLiveStatus status={socketStatus} />{!finished && <button type="button" disabled={busy} onClick={onForfeit}>Abandonar</button>}</div>
			</div>
			<div className="game-score game-multiplayer-score" aria-label="Marcador">
				<div><span>{me.display_name}</span><strong>{myScore}</strong></div>
				<div><span>Primero a</span><strong>{match.target_score}</strong></div>
				<div><span>{rival.display_name}</span><strong>{rivalScore}</strong></div>
			</div>
			<div className="game-arena" aria-live="polite">
				<div className="game-player-choice"><span>Tu ultima jugada</span><div>{myLatestChoice ? CHOICE_DETAILS[myLatestChoice].symbol : submitted ? '✓' : '·'}</div><strong>{submitted ? 'Eleccion enviada' : myLatestChoice ? CHOICE_DETAILS[myLatestChoice].label : 'Elige una opcion'}</strong></div>
				<div className={`game-result ${latest ? `is-${result}` : ''}`}><ScaleIcon size={28} className={submitted && !rivalSubmitted ? 'game-thinking' : ''} /><strong>{finished ? 'Partida finalizada' : submitted && !rivalSubmitted ? `Esperando a ${rival.display_name}` : rivalSubmitted && !submitted ? `${rival.display_name} ya eligio` : latest ? resultCopy[result] : `Ronda ${match.current_round?.number ?? 1}`}</strong></div>
				<div className="game-player-choice"><span>Ultima jugada rival</span><div>{rivalLatestChoice ? CHOICE_DETAILS[rivalLatestChoice].symbol : rivalSubmitted ? '✓' : '·'}</div><strong>{rivalLatestChoice ? CHOICE_DETAILS[rivalLatestChoice].label : rivalSubmitted ? 'Eleccion guardada' : 'Esperando'}</strong></div>
			</div>
			{finished
				? <MultiplayerWinnerPanel match={match} currentUserId={currentUserId} rivalLogin={rival.login} title={match.winner_user_id === currentUserId ? 'Has ganado' : `${rival.display_name} ha ganado`} score={`${myScore} - ${rivalScore}`} busy={busy} onRequest={onRequestRematch} onResolve={onResolveRematch} onExit={onExit} />
				: <ChoiceButtons disabled={busy || submitted} selected={null} onChoice={onMove} />}
			<div className="games-detail-grid">
				<section className="game-panel">
					<h2><HistoryIcon size={18} /> Historial compartido</h2>
					{match.rounds.length === 0 ? <p className="game-panel-empty">Las elecciones se revelan cuando ambos jugadores hayan respondido.</p> : <ol className="game-history">{match.rounds.slice(0, 8).map((round) => {
						const roundResult = round.winner_user_id === null ? 'tie' : round.winner_user_id === currentUserId ? 'win' : 'loss'
						const winnerChoice = round.winner_user_id === match.opponent.user_id ? round.opponent_choice : round.inviter_choice
						const loserChoice = round.winner_user_id === match.opponent.user_id ? round.inviter_choice : round.opponent_choice
						const copy = round.winner_user_id === null ? `${CHOICE_DETAILS[round.inviter_choice].label} empata con ${CHOICE_DETAILS[round.opponent_choice].label}` : `${CHOICE_DETAILS[winnerChoice].label} ${round.verb} ${CHOICE_DETAILS[loserChoice].label}`
						return <li key={round.number}><span className={`game-history-result is-${roundResult}`}>{roundResult === 'win' ? 'Victoria' : roundResult === 'loss' ? 'Derrota' : 'Empate'}</span><p>{copy}</p><span>{CHOICE_DETAILS[round.inviter_choice].symbol} · {CHOICE_DETAILS[round.opponent_choice].symbol}</span></li>
					})}</ol>}
				</section>
				<RulesPanel />
			</div>
		</>
	)
}

function MultiplayerLobby({ matches, friends, target, busy, socketStatus, onTarget, onInvite, onResolve, onRematchResolve }: {
	matches: MatchList
	friends: FriendEntry[]
	target: 3 | 5
	busy: boolean
	socketStatus: GameSocketStatus
	onTarget: (target: 3 | 5) => void
	onInvite: (friend: FriendEntry) => void
	onResolve: (match: MultiplayerMatch, action: 'accept' | 'decline' | 'cancel') => void
	onRematchResolve: (match: MultiplayerMatch, action: 'accept' | 'reject' | 'cancel') => void
}) {
	const unavailableIds = new Set([...matches.incoming, ...matches.outgoing, ...matches.active].flatMap((match) => [match.inviter.user_id, match.opponent.user_id]))
	const busyFriendIds = new Set(matches.outgoing.filter((match) => match.opponent_busy).map((match) => match.opponent.user_id))
	return (
		<div className="game-lobby-grid">
			<section className="game-panel game-invitations">
				<div className="game-panel-heading"><h2><Clock3Icon size={18} /> Invitaciones</h2><GameLiveStatus status={socketStatus} /></div>
				{matches.rematch_incoming.map((match) => {
					const requester = match.inviter.user_id === match.rematch_requested_by_user_id ? match.inviter : match.opponent
					return <div className="game-invitation-row" key={`rematch-in-${match.id}`}><div><strong>{requester.login}</strong><span>Quiere jugar una revancha contigo</span></div><div className="game-row-actions"><button type="button" className="is-accept" disabled={busy} onClick={() => onRematchResolve(match, 'accept')} title="Aceptar revancha"><CheckIcon size={18} /></button><button type="button" disabled={busy} onClick={() => onRematchResolve(match, 'reject')} title="Rechazar revancha"><XIcon size={18} /></button></div></div>
				})}
				{matches.rematch_outgoing.map((match) => {
					const recipient = match.inviter.user_id === match.rematch_requested_by_user_id ? match.opponent : match.inviter
					return <div className="game-invitation-row" key={`rematch-out-${match.id}`}><div><strong>{recipient.login}</strong><span>Esperando respuesta a la revancha</span></div><button type="button" className="game-cancel-invite" disabled={busy} onClick={() => onRematchResolve(match, 'cancel')}>Cancelar</button></div>
				})}
				{matches.incoming.map((match) => <div className="game-invitation-row" key={match.id}><div><strong>{match.inviter.display_name}</strong><span>{match.inviter_busy ? 'Esta en una partida. Puedes esperar o rechazar.' : `Primero a ${match.target_score}`}</span></div><div className="game-row-actions"><button type="button" className="is-accept" disabled={busy || match.inviter_busy} onClick={() => onResolve(match, 'accept')} title={match.inviter_busy ? 'Este jugador esta en una partida' : 'Aceptar'}><CheckIcon size={18} /></button><button type="button" disabled={busy} onClick={() => onResolve(match, 'decline')} title="Rechazar"><XIcon size={18} /></button></div></div>)}
				{matches.outgoing.map((match) => <div className="game-invitation-row" key={match.id}><div><strong>{match.opponent.display_name}</strong><span>{match.opponent_busy ? 'Esta en una partida. Puedes esperar o cancelar.' : 'Esperando respuesta'}</span></div><button type="button" className="game-cancel-invite" disabled={busy} onClick={() => onResolve(match, 'cancel')}>Cancelar</button></div>)}
				{matches.incoming.length + matches.outgoing.length + matches.rematch_incoming.length + matches.rematch_outgoing.length === 0 && <p className="game-panel-empty">No hay invitaciones pendientes.</p>}
			</section>
			<section className="game-panel game-friends-panel">
				<div className="game-panel-heading"><h2><UsersIcon size={18} /> Invitar a un amigo</h2><div className="game-small-segment">{([3, 5] as const).map((score) => <button type="button" key={score} className={target === score ? 'is-active' : ''} onClick={() => onTarget(score)}>A {score}</button>)}</div></div>
				{friends.length === 0 ? <p className="game-panel-empty">Agrega amigos desde Usuarios para poder invitarlos.</p> : <div className="game-friend-list">{friends.map((friend) => {
					const unavailable = unavailableIds.has(friend.userId)
					const friendIsBusy = busyFriendIds.has(friend.userId)
					return <div className="game-friend-row" key={friend.userId}><div className="game-friend-identity">{friend.avatarUrl ? <Image src={friend.avatarUrl} alt="" width={40} height={40} unoptimized /> : <span>{friend.displayName.slice(0, 1).toUpperCase()}</span>}<div><strong>{friend.displayName}</strong><small><i className={friend.active ? 'is-online' : ''} /> {friend.active ? 'En linea' : 'Desconectado'}</small></div></div><button type="button" disabled={busy || unavailable} onClick={() => onInvite(friend)}><UserPlusIcon size={17} /> {friendIsBusy ? 'En partida' : unavailable ? 'Partida abierta' : 'Invitar'}</button></div>
				})}</div>}
			</section>
		</div>
	)
}

function FriendsGame() {
	const user = useAuthStore((state) => state.user)
	const [matches, setMatches] = useState<MatchList>(EMPTY_MATCHES)
	const [friends, setFriends] = useState<FriendEntry[]>([])
	const [selected, setSelected] = useState<MultiplayerMatch | null>(null)
	const [target, setTarget] = useState<3 | 5>(3)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [socketStatus, setSocketStatus] = useState<GameSocketStatus>('connecting')

	const refresh = useCallback(async () => {
		try {
			const next = await fetchMatches()
			setMatches(next)
			const all = [...next.active, ...next.recent, ...next.incoming, ...next.outgoing]
			setSelected((current) => {
				const refreshed = all.find((match) => match.id === current?.id)
				const rematch = refreshed?.rematch_match_id
					? next.active.find((match) => match.id === refreshed.rematch_match_id)
					: null
				return rematch ?? refreshed ?? next.active[0] ?? null
			})
			setError(null)
		} catch (refreshError) {
			setError(refreshError instanceof Error ? refreshError.message : 'No se pudo sincronizar el juego')
		}
	}, [])

	useEffect(() => {
		void refresh()
		void fetchMyFriends().then((payload) => setFriends(payload.friends ?? [])).catch(() => setFriends([]))
		return subscribeGameSocket({
			onEvent: (event) => { if (event.type === 'game.event') void refresh() },
			onStatus: setSocketStatus,
		})
	}, [refresh])

	const runAction = async (action: () => Promise<MultiplayerMatch>, selectResult = true) => {
		setBusy(true)
		setError(null)
		try {
			const match = await action()
			setSelected(selectResult && (match.status === 'active' || match.status === 'completed') ? match : null)
			await refresh()
		} catch (actionError) {
			setError(actionError instanceof Error ? actionError.message : 'No se pudo completar la accion')
		} finally {
			setBusy(false)
		}
	}

	if (!user) return <section className="game-panel game-auth-required"><UsersIcon size={24} /><h2>Inicia sesion para jugar con amigos</h2></section>

	return (
		<>
			{error && <div className="game-error" role="alert">{error}</div>}
			{selected && (selected.status === 'active' || selected.status === 'completed') ? <MultiplayerArena match={selected} currentUserId={user.id} busy={busy} socketStatus={socketStatus} onMove={(choice) => void runAction(() => submitMatchMove(selected.id, choice))} onRequestRematch={() => void runAction(() => requestRematch(selected.id))} onResolveRematch={(action) => void runAction(() => resolveRematch(selected.id, action), action === 'accept' || action === 'reject')} onExit={() => { setSelected(null); void refresh() }} onForfeit={() => { if (window.confirm('¿Seguro que quieres abandonar? La victoria sera para tu rival.')) void runAction(() => updateMatchInvitation(selected.id, 'forfeit')) }} /> : <MultiplayerLobby matches={matches} friends={friends} target={target} busy={busy} socketStatus={socketStatus} onTarget={setTarget} onInvite={(friend) => void runAction(() => createMatchInvitation(friend.login, target))} onResolve={(match, action) => void runAction(() => updateMatchInvitation(match.id, action))} onRematchResolve={(match, action) => void runAction(() => resolveRematch(match.id, action), action === 'accept')} />}
		</>
	)
}

export default function GamesPage() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const view: GameView = searchParams.get('view') === 'friends' ? 'friends' : 'solo'
	const selectView = (nextView: GameView) => {
		router.replace(nextView === 'friends' ? '/games?view=friends' : '/games', { scroll: false })
	}
	return (
		<section className="games-page py-7">
			<header className="games-titlebar">
				<div><p className="games-eyebrow"><Gamepad2Icon size={16} /> Juego</p><h1>PPTLS</h1></div>
			</header>
			<div className="games-kind-switch" aria-label="Tipo de rival">
				<button type="button" className={view === 'solo' ? 'is-active' : ''} onClick={() => selectView('solo')}><Gamepad2Icon size={18} /> Contra CPU</button>
				<button type="button" className={view === 'friends' ? 'is-active' : ''} onClick={() => selectView('friends')}><UsersIcon size={18} /> Entre amigos</button>
			</div>
			{view === 'solo' ? <SoloGame /> : <FriendsGame />}
		</section>
	)
}
