import CardContainer from '@/components/CardContainer'
import type { ReactNode } from 'react'

type StatCardProps = {
	title: string
	value: ReactNode
	subtitle?: ReactNode
	valueClassName?: string
	className?: string
}

export default function StatCard({
	title,
	value,
	subtitle,
	valueClassName,
	className = 'p-6 text-center',
}: StatCardProps) {
	return (
		<CardContainer className={className}>
			<p className="mb-2 text-sm font-semibold uppercase text-text-secondary">{title}</p>
			<p className={valueClassName ?? 'text-4xl font-bold'}>{value}</p>
			{subtitle ? <p className="mt-2 text-xs text-text-secondary">{subtitle}</p> : null}
		</CardContainer>
	)
}