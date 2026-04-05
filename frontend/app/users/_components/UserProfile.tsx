import type { UserProfileView } from './types'

type UserProfileProps = {
	profile: UserProfileView
	coalitionColor: string
	currentLevel: number
	nextLevel: number
	levelProgress: number
	isOwnProfile: boolean
	friendRequestState?: 'none' | 'sent' | 'received' | 'friends'
	onLogout?: () => void
	onOpenPreferences?: () => void
	onSendFriendRequest?: () => void
	onWithdrawFriendRequest?: () => void
	onAcceptFriendRequest?: () => void
	onRejectFriendRequest?: () => void
	onRemoveFriend?: () => void
}

export function UserProfile({
	profile,
	coalitionColor,
	currentLevel,
	nextLevel,
	levelProgress,
	isOwnProfile,
	friendRequestState,
	onLogout,
	onOpenPreferences,
	onSendFriendRequest,
	onWithdrawFriendRequest,
	onAcceptFriendRequest,
	onRejectFriendRequest,
	onRemoveFriend,
}: UserProfileProps) {
	const relationshipState = friendRequestState ?? 'none'

	return (
		<section className="overflow-hidden px-6 py-12">
			<div className="mx-auto flex max-w-4xl flex-col items-center text-center">
				<div className="relative mb-9">
					{profile.avatar ? (
						<img
							src={profile.avatar}
							alt={`Avatar de ${profile.name}`}
							style={{ outlineColor: coalitionColor }}
							className="h-32 w-32 rounded-full border-4 border-card object-cover outline-3 md:h-40 md:w-40"
						/>
					) : (
						<div
							className="h-32 w-32 rounded-full border-4 border-card outline-3 md:h-40 md:w-40 flex items-center justify-center bg-card"
							style={{ outlineColor: coalitionColor }}
						>
							<span className="text-4xl">👤</span>
						</div>
					)}
					<div className="coalition-level" style={{ borderColor: 'var(--coalition-color)' }}>
						LVL {profile.level.toFixed(2)}
					</div>
				</div>
				<p className={`coalition-badge ${profile.coalition} capitalize mb-4`}>{profile.coalition}</p>
				<h1 className="text-4xl font-black tracking-tight md:text-5xl">{profile.name}</h1>
				<div className="mt-5 flex items-center gap-3">
					{isOwnProfile ? (
						<>
							<button
								type="button"
								className="cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold bg-(--coalition-color)/12 border-(--coalition-color) text-text hover:bg-(--coalition-color)/75 transition-colors"
								onClick={onOpenPreferences}
							>
								Editar configuración
							</button>
							<button
								type="button"
								className="cursor-pointer rounded-lg border border-border px-4 py-2 text-xs font-semibold text-text hover:bg-surface/70 transition-colors"
								onClick={onLogout}
							>
								Cerrar sesión
							</button>
						</>
					) : (
						<>
							{relationshipState === 'friends' && (
								<div className="flex flex-col items-center gap-2">
									<p className="text-xs text-text-secondary">Este usuario es tu amigo</p>
									<button
										type="button"
										className="cursor-pointer rounded-lg border border-border px-4 py-2 text-xs font-semibold text-text hover:bg-surface/70 transition-colors"
										onClick={onRemoveFriend}
									>
										Eliminar amigo
									</button>
								</div>
							)}

							{relationshipState === 'none' && (
								<button
									type="button"
									className="cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold bg-(--coalition-color)/12 border-(--coalition-color) text-text hover:bg-(--coalition-color)/75 transition-colors"
									onClick={onSendFriendRequest}
								>
									Enviar solicitud
								</button>
							)}

							{relationshipState === 'sent' && (
								<div className="flex flex-col items-center gap-2">
									<p className="text-xs text-text-secondary">Solicitud enviada</p>
									<button
										type="button"
										className="cursor-pointer rounded-lg border border-border px-4 py-2 text-xs font-semibold text-text hover:bg-surface/70 transition-colors"
										onClick={onWithdrawFriendRequest}
									>
										Retirar
									</button>
								</div>
							)}

							{relationshipState === 'received' && (
								<div className="flex flex-col items-center gap-2">
									<p className="text-xs text-text-secondary">Solicitud recibida</p>
									<div className="flex gap-2">
										<button
											type="button"
											className="cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold bg-(--coalition-color)/12 border-(--coalition-color) text-text hover:bg-(--coalition-color)/75 transition-colors"
											onClick={onAcceptFriendRequest}
										>
											Aceptar
										</button>
										<button
											type="button"
											className="cursor-pointer rounded-lg border border-border px-4 py-2 text-xs font-semibold text-text hover:bg-surface/70 transition-colors"
											onClick={onRejectFriendRequest}
										>
											Rechazar
										</button>
									</div>
								</div>
							)}
						</>
					)}
				</div>

				<div className="mt-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6">
					<div className="grid grid-cols-3 gap-4">
						<div className="text-center">
							<p className="text-[11px] uppercase tracking-[0.16em] text-text-secondary">Puntos de Coalicion</p>
							<p className="mt-1 text-2xl font-black">{profile.points.toLocaleString('es-ES')}</p>
						</div>
						<div className="text-center border-x-2 border-border">
							<p className="text-[11px] uppercase tracking-[0.16em] text-text-secondary">Ranking 42 Madrid</p>
							<p className="mt-1 text-2xl font-black">{profile.campusRank ? `#${profile.campusRank}` : 'N/D'}</p>
						</div>
						<div className="text-center">
							<p className="text-[11px] uppercase tracking-[0.16em] text-text-secondary">Ranking {profile.coalition}</p>
							<p className="mt-1 text-2xl font-black">{profile.campusRank ? `#${profile.coalitionRank}` : 'N/D'}</p>
						</div>
					</div>
					<div className="mt-5">
						<div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
							<span>Nivel {currentLevel} a {nextLevel}</span>
							<span>{levelProgress.toFixed(0)}%</span>
						</div>
						<div className="h-2 rounded-full bg-card">
							<div className="h-full rounded-full bg-(--coalition-color)" style={{ width: `${levelProgress}%` }} />
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
