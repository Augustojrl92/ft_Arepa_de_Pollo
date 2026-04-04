import { useState } from 'react'
import { mockAllies, mockIncomingRequests } from './mockData'
import type { IncomingAllyRequest, SentAllyRequest } from './types'

type UserAlliesProps = {
	currentLogin: string
}

export function UserAllies({ currentLogin }: UserAlliesProps) {
	const [sentRequests, setSentRequests] = useState<SentAllyRequest[]>([])
	const [incomingRequests, setIncomingRequests] = useState<IncomingAllyRequest[]>(mockIncomingRequests)
	const [allyTab, setAllyTab] = useState<'allies' | 'sent' | 'received'>('allies')
	const [requestLoginInput, setRequestLoginInput] = useState('')
	const [requestMessage, setRequestMessage] = useState<string | null>(null)

	const createAllyRequest = () => {
		const login = requestLoginInput.trim().toLowerCase()

		if (login.length < 2) {
			setRequestMessage('Introduce un login valido.')
			return
		}

		if (login === currentLogin.toLowerCase()) {
			setRequestMessage('No puedes enviarte una solicitud a ti mismo.')
			return
		}

		if (mockAllies.some((ally) => ally.login.toLowerCase() === login)) {
			setRequestMessage('Ese usuario ya es tu aliado.')
			return
		}

		if (sentRequests.some((request) => request.login.toLowerCase() === login)) {
			setRequestMessage('Ya tienes una solicitud pendiente para ese login.')
			return
		}

		setSentRequests((current) => [
			...current,
			{
				id: `sent-${Date.now()}-${login}`,
				login,
				createdAt: new Date().toLocaleString('es-ES'),
			},
		])
		setRequestLoginInput('')
		setRequestMessage('Solicitud enviada correctamente.')
		setAllyTab('sent')
	}

	const withdrawAllyRequest = (requestId: string) => {
		setSentRequests((current) => current.filter((request) => request.id !== requestId))
	}

	const resolveIncomingRequest = (requestId: string) => {
		setIncomingRequests((current) => current.filter((request) => request.id !== requestId))
	}

	return (
		<div className="rounded-3xl border border-border bg-card p-6">
			<div className="mb-5 flex items-center justify-between">
				<h2 className="text-xl font-black">Aliados</h2>
			</div>

			<div className="mb-4 flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => setAllyTab('allies')}
					className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${allyTab === 'allies' ? 'border-(--coalition-color) bg-(--coalition-color)/20' : 'border-border bg-card hover:bg-surface/60'}`}
				>
					Aliados ({mockAllies.length})
				</button>
				<button
					type="button"
					onClick={() => setAllyTab('sent')}
					className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${allyTab === 'sent' ? 'border-(--coalition-color) bg-(--coalition-color)/20' : 'border-border bg-card hover:bg-surface/60'}`}
				>
					Solicitudes enviadas {sentRequests.length > 0 && `(${sentRequests.length})`}
				</button>
				<button
					type="button"
					onClick={() => setAllyTab('received')}
					className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${allyTab === 'received' ? 'border-(--coalition-color) bg-(--coalition-color)/20' : 'border-border bg-card hover:bg-surface/60'}`}
				>
					Solicitudes recibidas {incomingRequests.length > 0 && `(${incomingRequests.length})`}
				</button>
			</div>

			<div className="space-y-3">
				{allyTab === 'allies' && (
					<div className="grid gap-3 sm:grid-cols-2">
						{mockAllies.map((ally) => (
							<article key={ally.login} className="rounded-xl border border-border bg-surface/50 p-3">
								<div className="flex items-center gap-4">
									<img src={ally.avatar} alt={`Avatar de ${ally.login}`} className="h-16 w-16 rounded-full border border-border object-cover" />
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-bold mb-1">{ally.login}</p>
										<p className="truncate text-xs text-text-secondary">{ally.coalition} • LVL {ally.level}</p>
									</div>
									<span className={`h-2.5 w-2.5 rounded-full ${ally.online ? 'bg-green-400' : 'bg-slate-500'}`} />
								</div>
							</article>
						))}
					</div>
				)}

				{allyTab === 'sent' && (
					<div className="space-y-3">
						{sentRequests.length === 0 && (
							<p className="rounded-lg border border-border bg-surface/40 p-3 text-sm text-text-secondary">No tienes solicitudes enviadas pendientes.</p>
						)}
						{sentRequests.map((request) => (
							<article key={request.id} className="rounded-lg border border-border bg-surface/40 p-3">
								<div className="flex items-center justify-between gap-3">
									<div>
										<p className="text-sm font-semibold">@{request.login}</p>
										<p className="text-xs text-text-secondary">Pendiente desde {request.createdAt}</p>
									</div>
									<button
										type="button"
										onClick={() => withdrawAllyRequest(request.id)}
										className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text hover:bg-card transition-colors"
									>
										Retirar
									</button>
								</div>
							</article>
						))}
						<div className="mb-4 rounded-xl border border-border bg-surface/40 p-3">
							<p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Nueva solicitud</p>
							<div className="mt-2 flex gap-2">
								<input
									type="text"
									value={requestLoginInput}
									onChange={(event) => {
										setRequestLoginInput(event.target.value)
										setRequestMessage(null)
									}}
									placeholder="login del usuario"
									className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
								/>
								<button
									type="button"
									onClick={createAllyRequest}
									className="cursor-pointer rounded-lg border border-(--coalition-color) bg-(--coalition-color)/15 px-3 py-2 text-xs font-semibold hover:bg-(--coalition-color)/30 transition-colors"
								>
									Solicitar
								</button>
							</div>
							{requestMessage && <p className="mt-2 text-xs text-text-secondary">{requestMessage}</p>}
						</div>
					</div>
				)}

				{allyTab === 'received' && (
					<div className="flex items-center justify-between gap-3">
						{incomingRequests.length === 0 && (
							<p className="flex-1 rounded-lg border border-border bg-surface/40 p-3 text-sm text-text-secondary">No tienes solicitudes pendientes.</p>
						)}
						{incomingRequests.map((request) => (
							<article key={request.id} className="flex-1 flex items-center justify-between rounded-lg border border-border bg-surface/40 p-3">
								<div className="flex items-center gap-3">
									<img src={request.avatar} alt={`Avatar de ${request.login}`} className="h-15 w-15 rounded-full border border-border object-cover" />
									<div className="flex-1 min-w-0">
										<p className="truncate text-sm font-semibold">{request.login}</p>
										<p className="truncate text-xs text-text-secondary">{request.coalition} • LVL {request.level}</p>
									</div>
								</div>
								<div className="flex flex-col gap-2">
									<button
										type="button"
										onClick={() => resolveIncomingRequest(request.id)}
										className="cursor-pointer rounded-md border border-(--coalition-color) bg-(--coalition-color)/15 px-3 py-1.5 text-xs font-semibold hover:bg-(--coalition-color)/30 transition-colors"
									>
										Aceptar
									</button>
									<button
										type="button"
										onClick={() => resolveIncomingRequest(request.id)}
										className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text hover:bg-card transition-colors"
									>
										Rechazar
									</button>
								</div>
							</article>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
