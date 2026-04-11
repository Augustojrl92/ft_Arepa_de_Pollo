import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	children: ReactNode
	tone?: 'default' | 'danger'
}

const tones = {
	default: 'text-text-secondary hover:text-text',
	danger: 'text-red-500 hover:text-red-400',
}

export default function IconActionButton({
	children,
	tone = 'default',
	className,
	...props
}: IconActionButtonProps) {
	return (
		<button
			{...props}
			className={`inline-flex items-center justify-center transition-colors ${tones[tone]} ${className ?? ''}`.trim()}
		>
			{children}
		</button>
	)
}