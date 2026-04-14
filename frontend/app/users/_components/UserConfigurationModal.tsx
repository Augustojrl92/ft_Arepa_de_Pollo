import { useEffect, useState, type ChangeEvent } from 'react'
import type { ProfilePreferences, RankingPerPage } from './types'
import { X } from 'lucide-react'

type UserPreferencesModalProps = {
	isOpen: boolean
	preferences: ProfilePreferences
	avatarUrl?: string
	hasCustomAvatar?: boolean
	isAvatarLoading?: boolean
	isPreferencesLoading?: boolean
	avatarError?: string | null
	onClose: () => void
	onSave: (nextPreferences: ProfilePreferences) => Promise<void> | void
	onUploadAvatar?: (file: File) => Promise<void>
	onRemoveAvatar?: () => Promise<void>
}

export function UserConfigurationModal({
	isOpen,
	preferences,
	avatarUrl,
	hasCustomAvatar = false,
	isAvatarLoading = false,
	isPreferencesLoading = false,
	avatarError = null,
	onClose,
	onSave,
	onUploadAvatar,
	onRemoveAvatar,
}: UserPreferencesModalProps) {
	const [draftPreferences, setDraftPreferences] = useState<ProfilePreferences>(preferences)
	const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

	useEffect(() => {
		if (!isOpen) {
			return
		}

		const onEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose()
			}
		}

		window.addEventListener('keydown', onEscape)
		document.body.style.overflow = 'hidden'

		return () => {
			window.removeEventListener('keydown', onEscape)
			document.body.style.overflow = ''
		}
	}, [isOpen, onClose])

	if (!isOpen) {
		return null
	}

	const updateDraftPreference = <K extends keyof ProfilePreferences>(key: K, value: ProfilePreferences[K]) => {
		setDraftPreferences((previous) => ({ ...previous, [key]: value }))
	}

	const handleAvatarInput = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file || !onUploadAvatar) {
			return
		}

		setSelectedFileName(file.name)
		await onUploadAvatar(file)
		setSelectedFileName(null)
		event.target.value = ''
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
			<div
				className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="mb-5 flex items-center justify-between">
					<h3 className="text-xl font-black">Configuración de cuenta</h3>
					<X size={20} className="cursor-pointer hover:text-accent" onClick={onClose} />
				</div>

				<div className="space-y-4">
					<div>
						<span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
							Avatar personalizado
						</span>
						<div className="rounded-xl border border-border bg-surface/40 p-3">
							<div className="flex items-center gap-4">
								{avatarUrl && hasCustomAvatar ? (
									<img src={avatarUrl} alt="Avatar actual" className="h-14 w-14 rounded-full object-cover" />
								) : (
									<div className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-lg">👤</div>
								)}
								<div className="flex-1">
									<p className="text-sm font-semibold">Subir nueva imagen</p>
									<p className="mt-1 text-xs text-text-secondary">PNG, JPG, WEBP o GIF. Maximo 2MB.</p>
									{selectedFileName && <p className="mt-1 text-xs text-text-secondary">Seleccionado: {selectedFileName}</p>}
									{avatarError && <p className="mt-2 text-xs text-[#ff355b]">{avatarError}</p>}
								</div>
							</div>
							<div className="mt-3 flex flex-wrap items-center gap-2">
								<label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-surface/70 transition-colors">
									<input
										type="file"
										accept="image/png,image/jpeg,image/webp,image/gif"
										onChange={(event) => {
											void handleAvatarInput(event)
										}}
										className="hidden"
										disabled={isAvatarLoading}
									/>
									{isAvatarLoading ? 'Subiendo...' : 'Seleccionar archivo'}
								</label>
								{hasCustomAvatar && (
									<button
										type="button"
										onClick={() => {
											if (onRemoveAvatar) {
												void onRemoveAvatar()
											}
										}}
										className="cursor-pointer rounded-lg border border-[#ff355b] px-3 py-2 text-xs font-semibold text-text hover:bg-[#ff355b]/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
									>
										Eliminar imagen
									</button>
								)}
							</div>
						</div>
					</div>

					<div>
						<label htmlFor="ranking-page-size" className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
							Elementos por pagina en ranking
						</label>
						<select
							id="ranking-page-size"
							value={draftPreferences.rankingPerPage}
							onChange={(event) => updateDraftPreference('rankingPerPage', Number(event.target.value) as RankingPerPage)}
							className="w-full rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm"
						>
							<option value={10}>10</option>
							<option value={25}>25</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
						</select>
					</div>

					<div>
						<label htmlFor="theme-edit-select" className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
							Tema
						</label>
						<select
							id="theme-edit-select"
							value={draftPreferences.theme}
							onChange={(event) => updateDraftPreference('theme', event.target.value as ProfilePreferences['theme'])}
							className="w-full rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm"
						>
							<option value="system">Sistema</option>
							<option value="light">Claro</option>
							<option value="dark">Oscuro</option>
						</select>
					</div>

					<div>
						<span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
							Preferencias
						</span>
						<div className="rounded-xl border border-border bg-surface/40 p-3">

							<div className="flex items-center justify-between gap-4">
								<div>
									<p className="text-sm font-semibold">Recibir notificaciones</p>
									<p className="mt-1 text-xs text-text-secondary">Activa avisos sobre ranking y actividad.</p>
								</div>
								<button
									type="button"
									role="switch"
									aria-checked={draftPreferences.notificationsEnabled}
									aria-label="Recibir notificaciones"
									onClick={() => updateDraftPreference('notificationsEnabled', !draftPreferences.notificationsEnabled)}
									className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${draftPreferences.notificationsEnabled ? 'bg-(--coalition-color)' : 'bg-slate-500/60'}`}
								>
									<span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${draftPreferences.notificationsEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
								</button>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-6 flex items-center justify-end gap-3">
					<button
						type="button"
						onClick={onClose}
						className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={() => {
							void onSave(draftPreferences)
						}}
						disabled={isPreferencesLoading}
						className="cursor-pointer rounded-lg border border-(--coalition-color) bg-(--coalition-color)/15 px-4 py-2 text-sm font-semibold text-text hover:bg-(--coalition-color)/35"
					>
						{isPreferencesLoading ? 'Guardando...' : 'Guardar cambios'}
					</button>
				</div>
			</div>
		</div>
	)
}
