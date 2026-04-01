'use client'
import { useState } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react'
import CardContainer from '../../../components/CardContainer';


// Datos mock para daily (últimos 7 días)
const dailyData = [
	{ day: 'Lun', points: 200 },
	{ day: 'Mar', points: 350 },
	{ day: 'Mié', points: 500 },
	{ day: 'Jue', points: 700 },
	{ day: 'Vie', points: 900 },
	{ day: 'Sáb', points: 1200 },
	{ day: 'Dom', points: 1500 },
];

// Datos mock para weekly (últimas 4 semanas)
const weeklyData = [
	{ week: 'Semana 1', points: 0 },
	{ week: 'Semana 2', points: 500 },
	{ week: 'Semana 3', points: 1500 },
	{ week: 'Semana 4', points: 3500 },
];

// Datos mock para monthly/cumulative (últimos 6 meses)
const monthlyData = [
	{ month: 'Ene', points: 0 },
	{ month: 'Feb', points: 0 },
	{ month: 'Mar', points: 0 },
	{ month: 'Abr', points: 500 },
	{ month: 'May', points: 2500 },
	{ month: 'Jun', points: 5500 },
];

const tabs = [
	{ key: 'weekly', label: '7 Días' },
	{ key: 'monthly', label: '30 Días' },
	{ key: 'cumulative', label: 'Temporada' },
];

interface PointsEvolutionChartProps {
	color: string;
	title?: string;
}

export default function PointsEvolutionChart({ color, title = 'Evolución de Puntos' }: PointsEvolutionChartProps) {
	const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'cumulative'>('weekly');

	let chartData: any[] = [];
	let xKey = '';
	if (activeTab === 'weekly') {
		chartData = dailyData;
		xKey = 'day';
	} else if (activeTab === 'monthly') {
		chartData = weeklyData;
		xKey = 'week';
	} else {
		chartData = monthlyData;
		xKey = 'month';
	}

	return (
		<CardContainer>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-4">
					<TrendingUp size={24} className="text-muted" style={{ color }} />
					<h2 className="font-semibold">{title}</h2>
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
							<stop offset="0%" stopColor={color} stopOpacity={0.45} />
							<stop offset="100%" stopColor={color} stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
					<XAxis dataKey={xKey} tick={{ fill: '#888', fontSize: 12 }} />
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
						stroke={color}
						strokeWidth={3}
						fill="url(#colorPoints)"
						dot={{ r: 5, fill: '#fff', fillOpacity: 1, stroke: color, strokeWidth: 3 }}
						activeDot={{ r: 8, fill: color, stroke: '#fff', strokeWidth: 3 }}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</CardContainer>
	);
}
