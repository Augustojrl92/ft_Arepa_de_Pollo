'use client'

import CustomButton from '@/components/CustomButton'

interface LeaderboardPaginationProps {
	currentPage: number
	onNext: () => void
	onPerPageChange: (value: number) => void
	onPrevious: () => void
	perPage: number
	summary: string
	totalPages: number
}

const pageSizes = [10, 25, 50, 100]

export const LeaderboardPagination = ({
	currentPage,
	onNext,
	onPerPageChange,
	onPrevious,
	perPage,
	summary,
	totalPages,
}: LeaderboardPaginationProps) => {
	return (
		<div className="bg-background/50 px-6 py-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
			<span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest">{summary}</span>
			<div className="flex items-center gap-2">
				<select
					value={perPage}
					onChange={(event) => onPerPageChange(Number(event.target.value))}
					className="bg-card border border-border rounded-md px-2 py-1 text-xs"
				>
					{pageSizes.map((size) => (
						<option key={size} value={size}>
							{size} / pagina
						</option>
					))}
				</select>
				<CustomButton
					type="button"
					variant="ghost"
					size="sm"
					disabled={currentPage === 1}
					onClick={onPrevious}
				>
					Anterior
				</CustomButton>
				<span className="text-xs font-bold text-text-secondary">{currentPage}/{totalPages}</span>
				<CustomButton
					type="button"
					variant="ghost"
					size="sm"
					disabled={currentPage >= totalPages}
					onClick={onNext}
				>
					Siguiente
				</CustomButton>
			</div>
		</div>
	)
}