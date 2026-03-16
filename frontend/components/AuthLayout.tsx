"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"

import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useAuthStore } from "@/hooks/useAuth"

const PUBLIC_ROUTES = ["/login"]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter()
	const pathname = usePathname()
	const hasInitializedRef = useRef(false)

	const initializeAuth = useAuthStore((s) => s.initializeAuth)
	const hasHydrated = useAuthStore((s) => s.hasHydrated)
	const status = useAuthStore((s) => s.status)

	const isReady = hasHydrated && status !== "idle" && status !== "loading"
	const isAuthenticated = status === "authenticated"
	const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

	useEffect(() => {
		if (!hasHydrated || hasInitializedRef.current) {
			return
		}

		hasInitializedRef.current = true
		void initializeAuth()
	}, [hasHydrated, initializeAuth])

	useEffect(() => {
		if (!isReady) {
			return
		}

		if (isAuthenticated && pathname === "/login") {
			router.replace("/")
			return
		}

		if (!isAuthenticated && !isPublicRoute) {
			router.replace("/login")
		}
	}, [isAuthenticated, isPublicRoute, isReady, pathname, router])

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

	return (
		<>
			<Header />
			<main className="aedlph-container flex-1">{children}</main>
			<Footer />
		</>
	)
}