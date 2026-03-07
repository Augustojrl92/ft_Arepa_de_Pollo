
export default function CardContainer({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div className={`flex-1 bg-card p-8 rounded-lg shadow-sm border-2 border-border ${className}`}>
			{children}
		</div>
	)
}