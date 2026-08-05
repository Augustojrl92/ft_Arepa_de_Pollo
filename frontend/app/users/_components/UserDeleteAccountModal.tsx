import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'

import CustomButton from '@/components/CustomButton'

type UserDeleteAccountModalProps = {
	isOpen: boolean
	login: string
	isSubmitting?: boolean
	onClose: () => void
	onConfirm: () => Promise<void> | void
}

export function UserDeleteAccountModal({
	isOpen,
	login,
	isSubmitting = false,
	onClose,
	onConfirm,
}: UserDeleteAccountModalProps) {
	const [confirmation, setConfirmation] = useState('')

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

	const canDelete = useMemo(
		() => confirmation.trim().toLowerCase() === login.trim().toLowerCase(),
		[confirmation, login],
	)

	if (!isOpen) {
		return null
	}

	return (
		<div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
			<div
				className="w-full max-w-xl rounded-2xl border border-[#ff355b]/40 bg-card p-6 shadow-2xl"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="mb-5 flex items-center justify-between gap-4">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff355b]">Zona de peligro</p>
						<h3 className="mt-2 text-2xl font-black text-text">Eliminar cuenta permanentemente</h3>
					</div>
					<X size={20} className="cursor-pointer hover:text-[#ff355b]" onClick={onClose} />
				</div>

				<div className="space-y-4 text-sm leading-6 text-text-secondary">
					<p>
						Esta acción eliminará tu cuenta de AEDLPH de forma permanente, junto con los datos personales asociados almacenados por la plataforma. No se puede deshacer.
					</p>
					<p>
						Escribe tu nombre de usuario <span className="font-semibold text-text">{login}</span> para confirmar.
					</p>
				</div>

				<div className="mt-4">
					<label htmlFor="delete-account-confirmation" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
						Confirmar nombre de usuario
					</label>
					<input
						id="delete-account-confirmation"
						type="text"
						value={confirmation}
						onChange={(event) => setConfirmation(event.target.value)}
						placeholder={login}
						className="w-full rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm text-text outline-none transition-colors focus:border-[#ff355b]"
					/>
				</div>

				<div className="mt-6 flex flex-wrap justify-end gap-3">
					<CustomButton type="button" variant="outline" size="sm" onClick={onClose}>
						Cancelar
					</CustomButton>
					<CustomButton
						type="button"
						variant="danger"
						size="sm"
						onClick={() => {
							if (canDelete) {
								void onConfirm()
							}
						}}
						disabled={!canDelete || isSubmitting}
					>
						{isSubmitting ? 'Eliminando...' : 'Eliminar cuenta'}
					</CustomButton>
				</div>
			</div>
		</div>
	)
}
