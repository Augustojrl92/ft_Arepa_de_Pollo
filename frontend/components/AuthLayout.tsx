"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"

import Header from "@/components/Header"
import Chat from "@/components/Chat"
import Footer from "@/components/Footer"
import { useAuthStore, useCoalitionStore, useUserStore } from "@/hooks"

const GUEST_ROUTE = "/guest"

const PUBLIC_ROUTES = [
	"/login",
	"/register",
	"/verify-email",
	"/reset-password",
	"/reset-password/confirm",
	"/privacy",
	"/terms",
	"/status",
	"/offline",
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const hasInitializedRef = useRef(false)
	const hasInitializedCoalitionsRef = useRef(false)
	const hasInitializedPreferencesRef = useRef(false)

	const initializeAuth = useAuthStore((s) => s.initializeAuth)
	const clearSession = useAuthStore((s) => s.clearSession)
	const hasHydrated = useAuthStore((s) => s.hasHydrated)
	const status = useAuthStore((s) => s.status)
	const user = useAuthStore((s) => s.user)
	const getCoalitions = useCoalitionStore((s) => s.getCoalitions)
	const getMyPreferences = useUserStore((s) => s.getMyPreferences)
	const { setTheme } = useTheme()

	const isReady = hasHydrated && status !== "idle" && status !== "loading"
	const isAuthenticated = status === "authenticated"
	const isPublicRoute = PUBLIC_ROUTES.includes(pathname)
	const hasAuthHint = searchParams.get("auth") === "1"
	// A guest holds a real session but no campus entitlement, so every campus
	// endpoint answers 403. Confining them to /guest keeps the app from firing
	// requests that can only fail.
	const isGuest = isAuthenticated && user?.role === "guest"
	const isGuestRoute = pathname === GUEST_ROUTE

	useEffect(() => {
		if (!hasHydrated || hasInitializedRef.current) {
			return
		}

		hasInitializedRef.current = true

		// On login route with no persisted user, avoid unnecessary auth bootstrap calls.
		if (isPublicRoute && !user) {
			clearSession()
			return
		}

		// On private routes, bootstrap auth only when a local session exists or OAuth callback explicitly hints to do so.
		if (!isPublicRoute && !user && !hasAuthHint) {
			clearSession()
			return
		}

		void initializeAuth()
	}, [clearSession, hasAuthHint, hasHydrated, initializeAuth, isPublicRoute, user])

	useEffect(() => {
		if (!isReady) {
			return
		}

		if (isAuthenticated && hasAuthHint) {
			router.replace(pathname)
			return
		}

		if (isAuthenticated && pathname === "/login") {
			router.replace(isGuest ? GUEST_ROUTE : "/")
			return
		}

		if (isGuest && !isGuestRoute) {
			router.replace(GUEST_ROUTE)
			return
		}

		// Students and admins have no business on the guest screen.
		if (isAuthenticated && !isGuest && isGuestRoute) {
			router.replace("/")
			return
		}

		if (!isAuthenticated && !isPublicRoute) {
			router.replace("/login")
		}
	}, [hasAuthHint, isAuthenticated, isGuest, isGuestRoute, isPublicRoute, isReady, pathname, router])

	useEffect(() => {
		if (!isReady || !isAuthenticated || isGuest || hasInitializedCoalitionsRef.current) {
			return
		}

		hasInitializedCoalitionsRef.current = true
		void getCoalitions()
	}, [getCoalitions, isAuthenticated, isGuest, isReady])

	useEffect(() => {
		if (!isReady || !isAuthenticated || isGuest || hasInitializedPreferencesRef.current) {
			return
		}

		hasInitializedPreferencesRef.current = true

		void getMyPreferences()
			.then((preferences) => {
				setTheme(preferences.theme)
				window.localStorage.setItem('leaderboard.defaultPerPage', String(preferences.rankingPerPage))
			})
			.catch(() => {
				// Keep default theme/per-page when preferences endpoint is temporarily unavailable.
			})
	}, [getMyPreferences, isAuthenticated, isGuest, isReady, setTheme])

	useEffect(() => {
		if (isAuthenticated) {
			return
		}

		hasInitializedPreferencesRef.current = false
	}, [isAuthenticated])

	useEffect(() => {
		if (!isReady || !isAuthenticated) {
			return
		}

		const intervalId = window.setInterval(() => {
			void initializeAuth()
		}, 10 * 60 * 1000)

		return () => {
			window.clearInterval(intervalId)
		}
	}, [initializeAuth, isAuthenticated, isReady])

	if (!isReady) {
		return null
	}

	if (isAuthenticated && pathname === "/login") {
		return null
	}

	if (!isAuthenticated && !isPublicRoute) {
		return null
	}

	if (!isAuthenticated) {
		return <main className="aedlph-container flex-1">{children}</main>
	}

	// No Header/Footer for guests: their nav would link to pages they cannot open.
	if (isGuest) {
		return <main className="aedlph-container flex-1">{children}</main>
	}

	return (
		<>
			<Header />
			<main className="aedlph-container flex-1">{children}</main>
			<Chat/>
			<Footer />
		</>
	)
}
