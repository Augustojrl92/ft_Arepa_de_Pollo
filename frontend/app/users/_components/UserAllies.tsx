import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUserStore } from '@/hooks'
import { searchFriendRequestUsers } from '@/lib/userApi'

type UserAlliesProps = {
	currentLogin: string
}

export function UserAllies({ currentLogin }: UserAlliesProps) {
	const {
		friends,
		error,
		isFriendsLoading,
		getMyFriends,
		sendFriendRequest,
		acceptFriendRequest,
		rejectFriendRequest,
		withdrawFriendRequest,
	} = useUserStore()

	const [allyTab, setAllyTab] = useState<'allies' | 'sent' | 'received'>('allies')
	const [requestLoginInput, setRequestLoginInput] = useState('')
	const [requestMessage, setRequestMessage] = useState<string | null>(null)
	const [searchResults, setSearchResults] = useState<Array<{ login: string; displayName: string; avatarUrl: string }>>([])
	const [isSearching, setIsSearching] = useState(false)

	useEffect(() => {
		void getMyFriends()
		const intervalId = window.setInterval(() => {
			void getMyFriends()
		}, 30_000)

		return () => window.clearInterval(intervalId)
	}, [getMyFriends])

	const allies = useMemo(() => friends?.friends ?? [], [friends?.friends])
	const sentRequests = useMemo(() => friends?.pendingSent ?? [], [friends?.pendingSent])
	const incomingRequests = useMemo(() => friends?.pendingReceived ?? [], [friends?.pendingReceived])

	useEffect(() => {
		const query = requestLoginInput.trim()
		if (query.length < 2) {
			setSearchResults([])
			setIsSearching(false)
			return
		}

		let isCancelled = false
		setSearchResults([])
		setIsSearching(true)

		const delayId = window.setTimeout(() => {
			if (isCancelled) {
				return
			}

			void searchFriendRequestUsers(query).then((results) => {
				if (!isCancelled) {
					setSearchResults(results)
				}
			}).catch(() => {
				if (!isCancelled) {
					setSearchResults([])
				}
			}).finally(() => {
				if (!isCancelled) {
					setIsSearching(false)
				}
			})
		}, 1_000)

		return () => {
			isCancelled = true
			window.clearTimeout(delayId)
			setIsSearching(false)
		}
	}, [requestLoginInput])

	const createAllyRequest = async () => {
		const login = requestLoginInput.trim().toLowerCase()

		if (login.length < 2) {
			setRequestMessage('Introduce un login valido.')
			return
		}

		if (login === currentLogin.toLowerCase()) {
			setRequestMessage('No puedes enviarte una solicitud a ti mismo.')
			return
		}

		if (allies.some((ally) => ally.login.toLowerCase() === login)) {
			setRequestMessage('Ese usuario ya es tu aliado.')
			return
		}

		if (sentRequests.some((request) => request.login.toLowerCase() === login)) {
			setRequestMessage('Ya tienes una solicitud pendiente para ese login.')
			return
		}

		try {
			await sendFriendRequest(login)
			setRequestLoginInput('')
			setSearchResults([])
			setRequestMessage('Solicitud enviada correctamente.')
			setAllyTab('sent')
		} catch {
			setRequestMessage('No se pudo enviar la solicitud.')
		}
	}

	const handleSelectSuggestion = async (login: string) => {
		const normalizedLogin = login.trim().toLowerCase()

		if (normalizedLogin.length < 2) {
			setRequestMessage('Introduce un login valido.')
			return
		}

		if (normalizedLogin === currentLogin.toLowerCase()) {
			setRequestMessage('No puedes enviarte una solicitud a ti mismo.')
			return
		}

		if (allies.some((ally) => ally.login.toLowerCase() === normalizedLogin)) {
			setRequestMessage('Ese usuario ya es tu aliado.')
			return
		}

		if (sentRequests.some((request) => request.login.toLowerCase() === normalizedLogin)) {
			setRequestMessage('Ya tienes una solicitud pendiente para ese login.')
			return
		}

		try {
			await sendFriendRequest(normalizedLogin)
			setRequestLoginInput('')
			setSearchResults([])
			setRequestMessage('Solicitud enviada correctamente.')
			setAllyTab('sent')
		} catch {
			setRequestMessage('No se pudo enviar la solicitud.')
		}
	}

	const onWithdrawAllyRequest = async (login: string) => {
		try {
			await withdrawFriendRequest(login)
		} catch {
			setRequestMessage('No se pudo retirar la solicitud.')
		}
	}

	const onAcceptIncomingRequest = async (login: string) => {
		try {
			await acceptFriendRequest(login)
		} catch {
			setRequestMessage('No se pudo aceptar la solicitud.')
		}
	}

	const onRejectIncomingRequest = async (login: string) => {
		try {
			await rejectFriendRequest(login)
		} catch {
			setRequestMessage('No se pudo rechazar la solicitud.')
		}
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
					Aliados ({allies.length})
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
				{error && <p className="rounded-lg border border-border bg-surface/40 p-3 text-sm text-text-secondary">{error}</p>}
				{isFriendsLoading && <p className="rounded-lg border border-border bg-surface/40 p-3 text-sm text-text-secondary">Actualizando aliados...</p>}

				{allyTab === 'allies' && (
					<div className="grid max-h-112 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
						{allies.map((ally) => (
							<Link key={ally.login} href={`/users/${ally.login}`} className="rounded-xl border border-border bg-surface/50 p-3">
								<div className="flex items-center gap-4">
									<img src={ally.avatarUrl} alt={`Avatar de ${ally.login}`} className="h-16 w-16 rounded-full border border-border object-cover" />
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-bold mb-1">{ally.login}</p>
										<p className="truncate text-xs text-text-secondary">{ally.displayName}</p>
									</div>
									<span className={`h-2.5 w-2.5 rounded-full ${ally.active ? 'bg-green-400' : 'bg-gray-600'}`} />
								</div>
							</Link>
						))}
						{allies.length === 0 && (
							<p className="rounded-lg border border-border bg-surface/40 p-3 text-sm text-text-secondary">Todavia no tienes aliados.</p>
						)}
					</div>
				)}

				{allyTab === 'sent' && (
					<div className="space-y-3">
						<div className="max-h-96 space-y-3 overflow-y-auto pr-1">
							{sentRequests.length === 0 && (
								<p className="rounded-lg border border-border bg-surface/40 p-3 text-sm text-text-secondary">No tienes solicitudes enviadas pendientes.</p>
							)}
							{sentRequests.map((request) => (
								<Link
									key={request.userId}
									href={`/users/${request.login}`}
									className="flex items-center justify-between rounded-lg border border-border bg-surface/40 p-3"
								>
									<div className="flex items-center gap-3">
										<img src={request.avatarUrl} alt={`Avatar de ${request.login}`} className="h-15 w-15 rounded-full border border-border object-cover" />
										<div className="flex-1 min-w-0">
											<p className="truncate text-sm font-semibold">{request.login}</p>
											<p className="truncate text-xs text-text-secondary">{request.displayName}</p>
										</div>
									</div>
									<div className="flex flex-col gap-2">
										<button
											type="button"
											onClick={(event) => {
												event.preventDefault()
												void onWithdrawAllyRequest(request.login)
											}}
											className="cursor-pointer rounded-md border border-[#ff355b] bg-[#ff355b]/12 px-3 py-1.5 text-xs font-semibold text-text hover:bg-[#ff355b]/25 transition-colors"
										>
											Retirar solicitud
										</button>
									</div>
								</Link>
							))}
						</div>

						<div className="rounded-xl border border-border bg-surface/40 p-3">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-sm font-semibold">Buscar usuario</p>
									<p className="text-xs text-text-secondary">Escribe un login y envía una solicitud directamente.</p>
								</div>
								<button
									type="button"
									onClick={createAllyRequest}
									className="cursor-pointer rounded-lg border border-(--coalition-color) bg-(--coalition-color)/15 px-3 py-2 text-xs font-semibold hover:bg-(--coalition-color)/30 transition-colors"
								>
									Solicitar
								</button>
							</div>
							<div className="mt-3 flex flex-col gap-2">
								<input
									type="text"
									value={requestLoginInput}
									onChange={(event) => {
										setRequestLoginInput(event.target.value)
										setRequestMessage(null)
									}}
									placeholder="Escribe el login del usuario"
									className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
								/>
								<div className="min-h-10 rounded-lg border border-dashed border-border/70 bg-card/40 p-2">
									{requestLoginInput.trim().length < 2 ? (
										<p className="text-xs text-text-secondary">Escribe al menos 2 letras para ver sugerencias.</p>
									) : isSearching ? (
										<p className="text-xs text-text-secondary">Buscando usuarios...</p>
									) : searchResults.length === 0 ? (
										<p className="text-xs text-text-secondary">No se encontraron usuarios.</p>
									) : (
										<div className="space-y-2">
											{searchResults.map((result) => (
												<button
													type="button"
													key={result.login}
													onClick={() => void handleSelectSuggestion(result.login)}
													className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-surface/60"
												>
													<div className="flex min-w-0 items-center gap-3">
														<img src={result.avatarUrl} alt={result.login} className="h-8 w-8 rounded-full object-cover" />
														<div className="min-w-0">
															<p className="truncate text-sm font-semibold">{result.login}</p>
															<p className="truncate text-xs text-text-secondary">{result.displayName}</p>
														</div>
													</div>
													<span className="text-xs font-semibold text-(--coalition-color)">Enviar</span>
												</button>
											))}
										</div>
									)}
								</div>
							</div>
							{requestMessage && <p className="mt-2 text-xs text-text-secondary">{requestMessage}</p>}
						</div>
					</div>
				)}

				{allyTab === 'received' && (
					<div className="max-h-112 space-y-3 overflow-y-auto pr-1">
						{incomingRequests.length === 0 && (
							<p className="rounded-lg border border-border bg-surface/40 p-3 text-sm text-text-secondary">No tienes solicitudes pendientes.</p>
						)}
						{incomingRequests.map((request) => (
							<Link key={request.userId} href={`/users/${request.login}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/40 p-3">
								<div className="flex items-center gap-3">
									<img src={request.avatarUrl} alt={`Avatar de ${request.login}`} className="h-15 w-15 rounded-full border border-border object-cover" />
									<div className="flex-1 min-w-0">
										<p className="truncate text-sm font-semibold">{request.login}</p>
										<p className="truncate text-xs text-text-secondary">{request.displayName}</p>
									</div>
								</div>
								<div className="flex flex-col gap-2">
									<button
										type="button"
										onClick={(event) => {
											event.preventDefault()
											void onAcceptIncomingRequest(request.login)
										}}
										className="cursor-pointer rounded-md border border-(--coalition-color) bg-(--coalition-color)/15 px-3 py-1.5 text-xs font-semibold hover:bg-(--coalition-color)/30 transition-colors"
									>
										Aceptar
									</button>
									<button
										type="button"
										onClick={(event) => {
											event.preventDefault()
											void onRejectIncomingRequest(request.login)
										}}
										className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text hover:bg-card transition-colors"
									>
										Rechazar
									</button>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
