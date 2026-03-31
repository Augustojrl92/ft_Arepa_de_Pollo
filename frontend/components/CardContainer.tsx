
export default function CardContainer({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
	return (
		<div className={`bg-card p-8 rounded-lg shadow-sm border-2 border-border ${className}`} style={style}>
			{children}
		</div>
	)
}