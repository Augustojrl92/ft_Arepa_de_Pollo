import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type CustomButtonVariant = 'coalition' | 'outline' | 'ghost' | 'danger' | 'accent'
type CustomButtonSize = 'sm' | 'md'

type BaseProps = {
	children: ReactNode
	className?: string
	variant?: CustomButtonVariant
	size?: CustomButtonSize
	fullWidth?: boolean
}

type ButtonProps = BaseProps &
	ButtonHTMLAttributes<HTMLButtonElement> & {
		href?: never
	}

type LinkProps = BaseProps & {
	href: string
	target?: string
	rel?: string
	'aria-label'?: string
	role?: string
	onClick?: () => void
	disabled?: boolean
}

type CustomButtonProps = ButtonProps | LinkProps

const baseClasses =
	'inline-flex items-center justify-center rounded-lg border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:opacity-50'

const variantClasses: Record<CustomButtonVariant, string> = {
	coalition:
		'bg-(--coalition-color)/12 border-(--coalition-color) text-text hover:bg-(--coalition-color)/75',
	outline: 'border-border text-text hover:bg-surface/70',
	ghost: 'border-transparent text-text-secondary hover:text-text hover:bg-card-hover',
	danger: 'bg-[#ff355b]/12 border-[#ff355b] text-text hover:bg-[#ff355b]/75',
	accent: 'bg-accent border-accent text-white hover:opacity-90',
}

const sizeClasses: Record<CustomButtonSize, string> = {
	sm: 'px-3 py-1 text-xs',
	md: 'px-4 py-2 text-sm',
}

function composeClasses(...classes: Array<string | undefined | false>): string {
	return classes.filter(Boolean).join(' ')
}

export default function CustomButton({
	children,
	className,
	variant = 'outline',
	size = 'md',
	fullWidth = false,
	...props
}: CustomButtonProps) {
	const classes = composeClasses(
		baseClasses,
		variantClasses[variant],
		sizeClasses[size],
		fullWidth && 'w-full',
		className,
	)

	if ('href' in props && typeof props.href === 'string') {
		const { href, target, rel, onClick, disabled, role } = props

		return (
			<Link
				href={href}
				target={target}
				rel={rel}
				aria-label={props['aria-label']}
				role={role}
				onClick={onClick}
				className={composeClasses(classes, disabled && 'pointer-events-none')}
			>
				{children}
			</Link>
		)
	}

	return (
		<button
			{...props}
			className={classes}
		>
			{children}
		</button>
	)
}