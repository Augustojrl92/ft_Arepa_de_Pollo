import { useEffect, useState } from 'react'
import type { ProfilePreferences, RankingPerPage } from './types'
import { X } from 'lucide-react'

type UserPreferencesModalProps = {
	isOpen: boolean
	preferences: ProfilePreferences
	onClose: () => void
	onSave: (nextPreferences: ProfilePreferences) => void
}

export function UserConfigurationModal({
	isOpen,
	preferences,
	onClose,
	onSave,
}: UserPreferencesModalProps) {
	const [draftPreferences, setDraftPreferences] = useState<ProfilePreferences>(preferences)

	useEffect(() => {
		if (!isOpen) {
			return
		}

		setDraftPreferences(preferences)
	}, [isOpen, preferences])

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

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
			<div
				className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="mb-5 flex items-center justify-between">
					<h3 className="text-xl font-black">Configuración de cuenta</h3>
					<X size={20} className="cursor-pointer hover:text-accent" />
				</div>

				<div className="space-y-4">
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
						onClick={() => onSave(draftPreferences)}
						className="cursor-pointer rounded-lg border border-(--coalition-color) bg-(--coalition-color)/15 px-4 py-2 text-sm font-semibold text-text hover:bg-(--coalition-color)/35"
					>
						Guardar cambios
					</button>
				</div>
			</div>
		</div>
	)
}
