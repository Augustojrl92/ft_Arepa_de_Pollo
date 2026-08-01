import { Engine, RuleProperties } from 'json-rules-engine'

export const RPSLS_CHOICES = ['rock', 'paper', 'scissors', 'lizard', 'spock'] as const

export type RpslsChoice = typeof RPSLS_CHOICES[number]
export type RpslsResult = 'win' | 'loss' | 'tie'

export type RpslsResolution = {
	result: RpslsResult
	verb: string
	winner: RpslsChoice | null
}

export const CHOICE_DETAILS: Record<RpslsChoice, { label: string; symbol: string }> = {
	rock: { label: 'Piedra', symbol: '🪨' },
	paper: { label: 'Papel', symbol: '📄' },
	scissors: { label: 'Tijera', symbol: '✂️' },
	lizard: { label: 'Lagarto', symbol: '🦎' },
	spock: { label: 'Spock', symbol: '🖖' },
}

export const WINNING_RELATIONS: Array<{
	winner: RpslsChoice
	loser: RpslsChoice
	verb: string
}> = [
	{ winner: 'scissors', loser: 'paper', verb: 'corta' },
	{ winner: 'paper', loser: 'rock', verb: 'cubre' },
	{ winner: 'rock', loser: 'lizard', verb: 'aplasta' },
	{ winner: 'lizard', loser: 'spock', verb: 'envenena' },
	{ winner: 'spock', loser: 'scissors', verb: 'rompe' },
	{ winner: 'scissors', loser: 'lizard', verb: 'decapita' },
	{ winner: 'lizard', loser: 'paper', verb: 'se come' },
	{ winner: 'paper', loser: 'spock', verb: 'refuta' },
	{ winner: 'spock', loser: 'rock', verb: 'vaporiza' },
	{ winner: 'rock', loser: 'scissors', verb: 'aplasta' },
]

const rules: RuleProperties[] = WINNING_RELATIONS.map((relation) => ({
	conditions: {
		all: [
			{ fact: 'first', operator: 'equal', value: relation.winner },
			{ fact: 'second', operator: 'equal', value: relation.loser },
		],
	},
	event: {
		type: 'winning-relation',
		params: relation,
	},
}))

const engine = new Engine(rules)

async function findWinningRelation(first: RpslsChoice, second: RpslsChoice) {
	const { events } = await engine.run({ first, second })
	return events[0]?.params as (typeof WINNING_RELATIONS)[number] | undefined
}

export async function resolveRpslsRound(
	player: RpslsChoice,
	cpu: RpslsChoice,
): Promise<RpslsResolution> {
	if (player === cpu) return { result: 'tie', verb: 'iguala', winner: null }

	const playerRelation = await findWinningRelation(player, cpu)
	if (playerRelation) {
		return { result: 'win', verb: playerRelation.verb, winner: player }
	}

	const cpuRelation = await findWinningRelation(cpu, player)
	if (!cpuRelation) throw new Error(`No existe una regla para ${player} contra ${cpu}`)
	return { result: 'loss', verb: cpuRelation.verb, winner: cpu }
}

export function randomRpslsChoice(): RpslsChoice {
	const values = new Uint32Array(1)
	crypto.getRandomValues(values)
	return RPSLS_CHOICES[values[0] % RPSLS_CHOICES.length]
}
