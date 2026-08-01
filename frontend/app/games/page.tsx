'use client'

import {
	CheckIcon,
	Clock3Icon,
	Gamepad2Icon,
	HistoryIcon,
	RotateCcwIcon,
	ScaleIcon,
	SwordsIcon,
	TrophyIcon,
	UserPlusIcon,
	UsersIcon,
	XIcon,
} from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuthStore } from '@/hooks/useAuth'
import {
	createMatchInvitation,
	fetchMatches,
	MatchList,
	MultiplayerMatch,
	requestRematch,
	submitMatchMove,
	updateMatchInvitation,
} from '@/lib/gameApi'
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
const EMPTY_MATCHES: MatchList = { incoming: [], outgoing: [], active: [], recent: [] }

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

function WinnerDialog({ title, score, onRematch, pending = false }: {
	title: string
	score: string
	onRematch: () => void
	pending?: boolean
}) {
	return (
		<div className="game-winner-backdrop">
			<section className="game-winner-dialog" role="dialog" aria-modal="true" aria-labelledby="game-winner-title">
				<div className="game-winner-trophy"><TrophyIcon size={34} /></div>
				<p>Partida finalizada</p>
				<h2 id="game-winner-title">{title}</h2>
				<strong>{score}</strong>
				<button type="button" onClick={onRematch} disabled={pending}>
					<RotateCcwIcon size={18} /> {pending ? 'Invitacion enviada' : 'Revancha'}
				</button>
			</section>
		</div>
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
			<ChoiceButtons disabled={isPlaying || Boolean(matchWinner)} selected={playerChoice} onChoice={(choice) => void playRound(choice)} />
			<div className="games-detail-grid">
				<section className="game-panel" aria-labelledby="history-title">
					<h2 id="history-title"><HistoryIcon size={18} /> Historial</h2>
					{game.history.length === 0 ? <p className="game-panel-empty">La primera ronda aparecera aqui.</p> : <ol className="game-history">{game.history.slice(0, 8).map((round) => <li key={round.id}><span className={`game-history-result is-${round.result}`}>{round.result === 'win' ? 'Victoria' : round.result === 'loss' ? 'Derrota' : 'Empate'}</span><p>{relationCopy(round)}</p><span>{CHOICE_DETAILS[round.player].symbol} · {CHOICE_DETAILS[round.opponent].symbol}</span></li>)}</ol>}
				</section>
				<RulesPanel />
			</div>
			{matchWinner && <WinnerDialog title={matchWinner === 'player' ? 'Has ganado' : 'La CPU ha ganado'} score={`${game.playerScore} - ${game.cpuScore}`} onRematch={() => resetMatch()} />}
		</>
	)
}

function ChoiceButtons({ disabled, selected, onChoice }: { disabled: boolean; selected: RpslsChoice | null; onChoice: (choice: RpslsChoice) => void }) {
	return <div className="game-choices" aria-label="Elige tu jugada">{RPSLS_CHOICES.map((choice) => <button key={choice} type="button" disabled={disabled} className={selected === choice ? 'is-selected' : ''} onClick={() => onChoice(choice)}><span aria-hidden="true">{CHOICE_DETAILS[choice].symbol}</span><strong>{CHOICE_DETAILS[choice].label}</strong></button>)}</div>
}

function MultiplayerArena({ match, currentUserId, onMove, onRematch, onForfeit, busy }: {
	match: MultiplayerMatch
	currentUserId: number
	onMove: (choice: RpslsChoice) => void
	onRematch: () => void
	onForfeit: () => void
	busy: boolean
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
				<div><p className="games-eyebrow"><SwordsIcon size={15} /> Partida #{match.id}</p><h2>{me.display_name} contra {rival.display_name}</h2></div>
				<div className="game-match-commands"><span className="game-live-badge"><span /> Sincronizada</span>{!finished && <button type="button" disabled={busy} onClick={onForfeit}>Abandonar</button>}</div>
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
			<ChoiceButtons disabled={busy || submitted || finished} selected={null} onChoice={onMove} />
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
			{finished && <WinnerDialog title={match.winner_user_id === currentUserId ? 'Has ganado' : `${rival.display_name} ha ganado`} score={`${myScore} - ${rivalScore}`} onRematch={onRematch} pending={busy} />}
		</>
	)
}

function MultiplayerLobby({ matches, friends, target, busy, onTarget, onInvite, onResolve }: {
	matches: MatchList
	friends: FriendEntry[]
	target: 3 | 5
	busy: boolean
	onTarget: (target: 3 | 5) => void
	onInvite: (friend: FriendEntry) => void
	onResolve: (match: MultiplayerMatch, action: 'accept' | 'decline' | 'cancel') => void
}) {
	const unavailableIds = new Set([...matches.incoming, ...matches.outgoing, ...matches.active].flatMap((match) => [match.inviter.user_id, match.opponent.user_id]))
	return (
		<div className="game-lobby-grid">
			<section className="game-panel game-invitations">
				<h2><Clock3Icon size={18} /> Invitaciones</h2>
				{matches.incoming.map((match) => <div className="game-invitation-row" key={match.id}><div><strong>{match.inviter.display_name}</strong><span>Primero a {match.target_score}</span></div><div className="game-row-actions"><button type="button" className="is-accept" disabled={busy} onClick={() => onResolve(match, 'accept')} title="Aceptar"><CheckIcon size={18} /></button><button type="button" disabled={busy} onClick={() => onResolve(match, 'decline')} title="Rechazar"><XIcon size={18} /></button></div></div>)}
				{matches.outgoing.map((match) => <div className="game-invitation-row" key={match.id}><div><strong>{match.opponent.display_name}</strong><span>Esperando respuesta</span></div><button type="button" className="game-cancel-invite" disabled={busy} onClick={() => onResolve(match, 'cancel')}>Cancelar</button></div>)}
				{matches.incoming.length + matches.outgoing.length === 0 && <p className="game-panel-empty">No hay invitaciones pendientes.</p>}
			</section>
			<section className="game-panel game-friends-panel">
				<div className="game-panel-heading"><h2><UsersIcon size={18} /> Invitar a un amigo</h2><div className="game-small-segment">{([3, 5] as const).map((score) => <button type="button" key={score} className={target === score ? 'is-active' : ''} onClick={() => onTarget(score)}>A {score}</button>)}</div></div>
				{friends.length === 0 ? <p className="game-panel-empty">Agrega amigos desde Usuarios para poder invitarlos.</p> : <div className="game-friend-list">{friends.map((friend) => {
					const unavailable = unavailableIds.has(friend.userId)
					return <div className="game-friend-row" key={friend.userId}><div className="game-friend-identity">{friend.avatarUrl ? <Image src={friend.avatarUrl} alt="" width={40} height={40} unoptimized /> : <span>{friend.displayName.slice(0, 1).toUpperCase()}</span>}<div><strong>{friend.displayName}</strong><small><i className={friend.active ? 'is-online' : ''} /> {friend.active ? 'En linea' : 'Desconectado'}</small></div></div><button type="button" disabled={busy || unavailable} onClick={() => onInvite(friend)}><UserPlusIcon size={17} /> {unavailable ? 'Partida abierta' : 'Invitar'}</button></div>
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

	const refresh = useCallback(async () => {
		try {
			const next = await fetchMatches()
			setMatches(next)
			const all = [...next.active, ...next.recent, ...next.incoming, ...next.outgoing]
			setSelected((current) => all.find((match) => match.id === current?.id) ?? next.active[0] ?? null)
			setError(null)
		} catch (refreshError) {
			setError(refreshError instanceof Error ? refreshError.message : 'No se pudo sincronizar el juego')
		}
	}, [])

	useEffect(() => {
		void refresh()
		void fetchMyFriends().then((payload) => setFriends(payload.friends ?? [])).catch(() => setFriends([]))
		const interval = window.setInterval(() => void refresh(), 2000)
		return () => window.clearInterval(interval)
	}, [refresh])

	const runAction = async (action: () => Promise<MultiplayerMatch>) => {
		setBusy(true)
		setError(null)
		try {
			const match = await action()
			setSelected(match.status === 'active' || match.status === 'completed' ? match : null)
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
			{selected && (selected.status === 'active' || selected.status === 'completed') ? <MultiplayerArena match={selected} currentUserId={user.id} busy={busy} onMove={(choice) => void runAction(() => submitMatchMove(selected.id, choice))} onRematch={() => void runAction(() => requestRematch(selected.id))} onForfeit={() => { if (window.confirm('¿Seguro que quieres abandonar? La victoria sera para tu rival.')) void runAction(() => updateMatchInvitation(selected.id, 'forfeit')) }} /> : <MultiplayerLobby matches={matches} friends={friends} target={target} busy={busy} onTarget={setTarget} onInvite={(friend) => void runAction(() => createMatchInvitation(friend.login, target))} onResolve={(match, action) => void runAction(() => updateMatchInvitation(match.id, action))} />}
		</>
	)
}

export default function GamesPage() {
	const [view, setView] = useState<GameView>('solo')
	return (
		<section className="games-page py-7">
			<header className="games-titlebar">
				<div><p className="games-eyebrow"><Gamepad2Icon size={16} /> Juegos</p><h1>Piedra, Papel, Tijera, Lagarto, Spock</h1></div>
			</header>
			<div className="games-kind-switch" aria-label="Tipo de rival">
				<button type="button" className={view === 'solo' ? 'is-active' : ''} onClick={() => setView('solo')}><Gamepad2Icon size={18} /> Contra CPU</button>
				<button type="button" className={view === 'friends' ? 'is-active' : ''} onClick={() => setView('friends')}><UsersIcon size={18} /> Entre amigos</button>
			</div>
			{view === 'solo' ? <SoloGame /> : <FriendsGame />}
		</section>
	)
}
