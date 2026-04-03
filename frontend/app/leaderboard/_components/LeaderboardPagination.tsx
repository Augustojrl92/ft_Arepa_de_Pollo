'use client'

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
				<button
					disabled={currentPage === 1}
					onClick={onPrevious}
					className="px-3 py-1 text-xs font-bold rounded-md hover:bg-card-hover text-text-secondary disabled:opacity-50"
				>
					Anterior
				</button>
				<span className="text-xs font-bold text-text-secondary">{currentPage}/{totalPages}</span>
				<button
					disabled={currentPage >= totalPages}
					onClick={onNext}
					className="px-3 py-1 text-xs font-bold rounded-md hover:bg-card-hover text-text-secondary disabled:opacity-50"
				>
					Siguiente
				</button>
			</div>
		</div>
	)
}