
import { useState } from "react"
import { RankingEntry } from "@/types"
import { useCoalitionStore } from "@/hooks"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

export const LeaderboardUsers = ({ranking}: {ranking: RankingEntry[]}) => {
	const { coalitions } = useCoalitionStore();
	const [sortBy, setSortBy] = useState<'rank'|'coalition'|'login'|'intraLevel'|'coalitionPoints'>('rank');
	const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
	const [page, setPage] = useState(1);
	const [perPage, setPerPage] = useState(20);

	if (!ranking || ranking.length === 0) {
		return <div className="text-text-secondary mt-6">No hay usuarios para mostrar.</div>;
	}

	// Ordenar
	const sorted = [...ranking].sort((a, b) => {
		let vA = a[sortBy];
		let vB = b[sortBy];
		if (typeof vA === 'string' && typeof vB === 'string') {
			return sortDir === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
		}
		return sortDir === 'asc' ? (vA as number) - (vB as number) : (vB as number) - (vA as number);
	});
	// Paginación
	const totalPages = Math.ceil(sorted.length / perPage);
	const paginated = sorted.slice((page-1)*perPage, page*perPage);

	// Handler de orden
	const handleSort = (col: typeof sortBy) => {
		if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
		else {
			setSortBy(col);
			setSortDir('desc');
		}
	};

	return (
		<div className="overflow-x-auto mt-6">
			<div className="flex items-center justify-between mb-2">
				<div className="flex gap-2 items-center">
					<label htmlFor="perPage" className="text-sm">Usuarios por página:</label>
					<select id="perPage" value={perPage} onChange={e => {setPerPage(Number(e.target.value)); setPage(1);}} className="border rounded px-2 py-1">
						{[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
					</select>
				</div>
				<div className="flex gap-2 items-center">
					<button disabled={page === 1} onClick={()=>setPage(page-1)} className="px-2 py-1 border rounded disabled:opacity-50">Anterior</button>
					<span className="text-sm">Página {page} de {totalPages}</span>
					<button disabled={page === totalPages} onClick={()=>setPage(page+1)} className="px-2 py-1 border rounded disabled:opacity-50">Siguiente</button>
				</div>
			</div>
			<table className="min-w-full border-separate border-spacing-y-2 rounded-lg overflow-hidden shadow-lg">
				<thead className="sticky top-0 z-10">
					<tr className="bg-muted text-left text-sm uppercase text-text-secondary">
						<th className="px-4 py-2 cursor-pointer" onClick={()=>handleSort('rank')}>Posición {sortBy==='rank' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
						<th className="px-4 py-2 cursor-pointer" onClick={()=>handleSort('coalition')}>Coalición {sortBy==='coalition' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
						<th className="px-4 py-2 cursor-pointer" onClick={()=>handleSort('login')}>Login {sortBy==='login' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
						<th className="px-4 py-2 cursor-pointer" onClick={()=>handleSort('intraLevel')}>Nivel {sortBy==='intraLevel' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
						<th className="px-4 py-2 cursor-pointer" onClick={()=>handleSort('coalitionPoints')}>Puntos {sortBy==='coalitionPoints' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
						<th className="px-4 py-2 ">Cambio</th>
					</tr>
				</thead>
				<tbody className="text-left">
					{paginated.map((user) => {
						const coalition = coalitions.find(c => c.slug === user.coalition);
						const change = 0;
						return (
							<tr key={user.login}>
								<td colSpan={6} className="p-0">
									<div className="bg-card border-2 border-border rounded-xl flex items-center transition-colors hover:border-accent shadow-sm my-1">
										<div className="flex-1 grid grid-cols-6">
											<div className="px-4 py-4 font-bold text-accent flex items-center">{user.rank}</div>
											<div className="px-4 py-4 flex items-center">
												<span className="font-semibold" style={{color: coalition?.color || '#888'}}>{coalition?.name || user.coalition}</span>
											</div>
											<div className="px-4 py-4 flex items-center">
												<span className="font-medium">{user.login}</span>
											</div>
											<div className="px-4 py-4 font-medium flex items-center">{user.intraLevel}</div>
											<div className="px-4 py-4 font-medium flex items-center">{user.coalitionPoints}</div>
											<div className="px-4 py-4 font-medium flex items-center">
												{change > 0 && <span className="flex items-center gap-1 text-green-600"><ArrowUp size={16}/>{`+${change}`}</span>}
												{change < 0 && <span className="flex items-center gap-1 text-red-600"><ArrowDown size={16}/>{`${change}`}</span>}
												{change === 0 && <span className="flex items-center gap-1 text-gray-400"><Minus size={16}/></span>}
											</div>
										</div>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}