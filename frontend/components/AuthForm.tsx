"use client"

import Link from "next/link"
import type { InputHTMLAttributes, ReactNode } from "react"

import CardContainer from "@/components/CardContainer"

/** Shared shell for the logged-out auth screens (login, register, reset). */
export function AuthShell({
	title,
	subtitle,
	children,
	footer,
}: {
	title: string
	subtitle?: string
	children: ReactNode
	footer?: ReactNode
}) {
	return (
		<section className="min-h-screen bg-surface flex items-center justify-center px-4 py-10">
			<div className="w-full max-w-sm flex flex-col items-center gap-8">
				<div className="flex flex-col items-center gap-2">
					<Link href="/login" className="text-4xl font-black tracking-tight text-accent">
						AEDLPH
					</Link>
					<span className="text-sm text-text-secondary">Improved 42 Coalitions</span>
				</div>

				<CardContainer className="w-full flex flex-col gap-6">
					<div className="flex flex-col gap-1 text-center">
						<h1 className="text-xl font-bold">{title}</h1>
						{subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
					</div>

					{children}
				</CardContainer>

				{footer}
			</div>
		</section>
	)
}

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
	label: string
	error?: string | null
}

export function AuthField({ label, error, id, ...inputProps }: AuthFieldProps) {
	const errorId = error ? `${id}-error` : undefined

	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium text-text-secondary">
				{label}
			</label>
			<input
				id={id}
				aria-invalid={Boolean(error)}
				aria-describedby={errorId}
				className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-accent ${
					error ? "border-red-500" : "border-border"
				}`}
				{...inputProps}
			/>
			{error && (
				<p id={errorId} className="text-xs text-red-500">
					{error}
				</p>
			)}
		</div>
	)
}

export function AuthSubmit({ children, isLoading }: { children: ReactNode; isLoading: boolean }) {
	return (
		<button
			type="submit"
			disabled={isLoading}
			className="cursor-pointer w-full rounded-lg bg-accent py-3 px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
		>
			{isLoading ? <span className="animate-pulse">Enviando...</span> : children}
		</button>
	)
}

export function AuthFeedback({ error, success }: { error?: string | null; success?: string | null }) {
	if (!error && !success) {
		return null
	}

	return (
		<p
			role="status"
			className={`text-center text-sm ${error ? "text-red-500" : "text-emerald-500"}`}
		>
			{error ?? success}
		</p>
	)
}
