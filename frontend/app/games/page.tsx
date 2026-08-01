'use client'

import { Gamepad2Icon, HistoryIcon, RotateCcwIcon, ScaleIcon, TrophyIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
	CHOICE_DETAILS,
	RPSLS_CHOICES,
	RpslsChoice,
	RpslsResult,
	WINNING_RELATIONS,
	randomRpslsChoice,
	resolveRpslsRound,
} from '@/lib/rpsls'

type MatchTarget = 0 | 3 | 5

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

function WinnerDialog({ winner, score, onRematch }: {
	winner: 'player' | 'cpu'
	score: string
	onRematch: () => void
}) {
	return (
		<div className="game-winner-backdrop">
			<section className="game-winner-dialog" role="dialog" aria-modal="true" aria-labelledby="game-winner-title">
				<div className="game-winner-trophy"><TrophyIcon size={34} /></div>
				<p>Partida finalizada</p>
				<h2 id="game-winner-title">{winner === 'player' ? 'Has ganado' : 'La CPU ha ganado'}</h2>
				<strong>{score}</strong>
				<button type="button" onClick={onRematch}><RotateCcwIcon size={18} /> Revancha</button>
			</section>
		</div>
	)
}

export default function GamesPage() {
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
		const nextRound: Round = {
			id: Date.now(),
			player: choice,
			opponent: computer,
			result: resolution.result,
			verb: resolution.verb,
		}

		setCpuChoice(computer)
		setRoundResult(resolution.result)
		setGame((current) => ({
			...current,
			playerScore: current.playerScore + (resolution.result === 'win' ? 1 : 0),
			cpuScore: current.cpuScore + (resolution.result === 'loss' ? 1 : 0),
			ties: current.ties + (resolution.result === 'tie' ? 1 : 0),
			history: [nextRound, ...current.history].slice(0, 12),
		}))
		playingRef.current = false
		setIsPlaying(false)
	}

	return (
		<section className="games-page py-7">
			<header className="games-titlebar">
				<div>
					<p className="games-eyebrow"><Gamepad2Icon size={16} /> Juegos contra CPU</p>
					<h1>Piedra, Papel, Tijera, Lagarto, Spock</h1>
				</div>
				<button type="button" className="game-icon-command" disabled={isPlaying} onClick={() => resetMatch()} title="Reiniciar partida" aria-label="Reiniciar partida">
					<RotateCcwIcon size={19} />
				</button>
			</header>

			<div className="game-mode" aria-label="Modo de partida">
				{([3, 5, 0] as MatchTarget[]).map((target) => (
					<button key={target} type="button" disabled={isPlaying} className={game.target === target ? 'is-active' : ''} onClick={() => resetMatch(target)}>
						{target ? `Primero a ${target}` : 'Libre'}
					</button>
				))}
			</div>

			<div className="game-score" aria-label="Marcador">
				<div><span>Tu</span><strong>{game.playerScore}</strong></div>
				<div><span>Empates</span><strong>{game.ties}</strong></div>
				<div><span>CPU</span><strong>{game.cpuScore}</strong></div>
			</div>

			<div className="game-arena" aria-live="polite">
				<div className="game-player-choice">
					<span>Tu eleccion</span>
					<div>{playerChoice ? CHOICE_DETAILS[playerChoice].symbol : '·'}</div>
					<strong>{playerChoice ? CHOICE_DETAILS[playerChoice].label : 'Elige una opcion'}</strong>
				</div>
				<div className={`game-result ${roundResult ? `is-${roundResult}` : ''}`}>
					{matchWinner ? <><TrophyIcon size={28} /><strong>Partida finalizada</strong></>
						: isPlaying ? <><ScaleIcon size={28} className="game-thinking" /><strong>La CPU esta eligiendo</strong></>
							: roundResult ? <><ScaleIcon size={28} /><strong>{resultCopy[roundResult]}</strong></>
								: <><ScaleIcon size={28} /><strong>Preparado</strong></>}
				</div>
				<div className="game-player-choice">
					<span>CPU</span>
					<div>{cpuChoice ? CHOICE_DETAILS[cpuChoice].symbol : isPlaying ? '?' : '·'}</div>
					<strong>{cpuChoice ? CHOICE_DETAILS[cpuChoice].label : 'Esperando'}</strong>
				</div>
			</div>

			<div className="game-choices" aria-label="Elige tu jugada">
				{RPSLS_CHOICES.map((choice) => (
					<button key={choice} type="button" disabled={isPlaying || Boolean(matchWinner)} className={playerChoice === choice ? 'is-selected' : ''} onClick={() => void playRound(choice)}>
						<span aria-hidden="true">{CHOICE_DETAILS[choice].symbol}</span>
						<strong>{CHOICE_DETAILS[choice].label}</strong>
					</button>
				))}
			</div>

			<div className="games-detail-grid">
				<section className="game-panel" aria-labelledby="history-title">
					<h2 id="history-title"><HistoryIcon size={18} /> Historial</h2>
					{game.history.length === 0
						? <p className="game-panel-empty">La primera ronda aparecera aqui.</p>
						: <ol className="game-history">
							{game.history.slice(0, 8).map((round) => (
								<li key={round.id}>
									<span className={`game-history-result is-${round.result}`}>
										{round.result === 'win' ? 'Victoria' : round.result === 'loss' ? 'Derrota' : 'Empate'}
									</span>
									<p>{relationCopy(round)}</p>
									<span>{CHOICE_DETAILS[round.player].symbol} · {CHOICE_DETAILS[round.opponent].symbol}</span>
								</li>
							))}
						</ol>}
				</section>
				<RulesPanel />
			</div>

			{matchWinner && (
				<WinnerDialog
					winner={matchWinner}
					score={`${game.playerScore} - ${game.cpuScore}`}
					onRematch={() => resetMatch()}
				/>
			)}
		</section>
	)
}
