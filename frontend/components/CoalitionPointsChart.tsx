'use client'
import { useEffect, useState } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react'
import CardContainer from './CardContainer';
import { fetchUserPointsHistory } from '@/lib/userApi';
import { buildChartPoints } from '@/lib/pointsHistory';
import { PointsHistoryEntry } from '@/types';

const tabs = [
	{ key: 'weekly', label: '7 Días' },
	{ key: 'monthly', label: '30 Días' },
	{ key: 'cumulative', label: 'Temporada' },
];

interface CoalitionPointsChartProps {
	userLogin: string | null;
}

export default function CoalitionPointsChart({ userLogin }: CoalitionPointsChartProps) {
	const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'cumulative'>('weekly');
	const [history, setHistory] = useState<PointsHistoryEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!userLogin) {
			setHistory([]);
			setIsLoading(false);
			setError(null);
			return;
		}

		let isMounted = true;

		const loadHistory = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const payload = await fetchUserPointsHistory(userLogin);
				if (!isMounted) {
					return;
				}
				setHistory(payload.history);
			} catch (err) {
				if (!isMounted) {
					return;
				}
				setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
				setHistory([]);
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		void loadHistory();

		return () => {
			isMounted = false;
		};
	}, [userLogin]);

	const chartData = buildChartPoints(history, activeTab);

	if (isLoading) {
		return (
			<CardContainer>
				<div className="h-[356px] animate-pulse rounded-lg bg-surface-elevated" />
			</CardContainer>
		);
	}

	if (error) {
		return (
			<CardContainer>
				<div className="flex h-[356px] items-center justify-center text-sm text-red-400">
					{error}
				</div>
			</CardContainer>
		);
	}

	if (chartData.length === 0) {
		return (
			<CardContainer>
				<div className="flex h-[356px] items-center justify-center text-sm text-text-secondary">
					No hay snapshots de puntos para este usuario.
				</div>
			</CardContainer>
		);
	}

	return (
		<CardContainer>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-4">
					<TrendingUp size={24} className="text-muted" color="var(--color-accent)" />
					<h2 className="font-semibold">Evolución de Tus Puntos</h2>
				</div>
				<div className="flex items-center gap-2 bg-[#1E293B] py-2 px-3 rounded-lg">
					{tabs.map((tab) => (
						<button
							key={tab.key}
							className={`cursor-pointer px-4 py-2 rounded-md text-sm font-medium ${activeTab === tab.key ? 'bg-card-hover text-primary' : 'bg-muted text-text-secondary'}`}
							onClick={() => setActiveTab(tab.key as any)}
						>
							{tab.label}
						</button>
					))}
				</div>
			</div>
			<ResponsiveContainer width="100%" height={300}>
				<AreaChart
					data={chartData}
					margin={{ top: 20, right: 30, left: 30, bottom: 0 }}
				>
					<defs>
						<linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="#00eaff" stopOpacity={0.45} />
							<stop offset="100%" stopColor="#00eaff" stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
					<XAxis dataKey="label" tick={{ fill: '#888', fontSize: 12 }} />
					<YAxis hide />
					<Tooltip contentStyle={{
						background: '#222',
						border: 'none',
						color: '#fff',
						fontFamily: 'var(--font-family, inherit)'
					}} cursor={false} />
					<Area
						type="monotone"
						dataKey="points"
						stroke="#00eaff"
						strokeWidth={3}
						fill="url(#colorPoints)"
						dot={{ r: 5, fill: '#fff', fillOpacity: 1, stroke: '#00eaff', strokeWidth: 3 }}
						activeDot={{ r: 8, fill: '#00eaff', stroke: '#fff', strokeWidth: 3 }}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</CardContainer>
	);
}
