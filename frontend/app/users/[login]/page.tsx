'use client'

import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore, useCoalitionStore, useUserStore } from '@/hooks'
import { UserAchievements } from '../_components/UserAchievements'
import { UserAchievementsComparison } from '../_components/UserAchievementsComparison'
import { UserAllies } from '../_components/UserAllies'
import { UserConfigurationModal } from '../_components/UserConfigurationModal'
import { UserProfile } from '../_components/UserProfile'
import { defaultPreferences } from '../_components/mockData'
import type { ProfilePreferences } from '../_components/types'
import type { UserProfileView } from '../_components/types'


export default function UserDetailPage({
	params,
}: {
	params?: Promise<{ login: string }>
}) {
	const { user, logout } = useAuthStore()
	const {
		user: fetchedUser,
		achievements,
		friends,
		isLoading,
		isFriendsLoading,
		error,
		getUserDetails,
		getMyAchievements,
		getMyFriends,
		getRelationshipStateByLogin,
		sendFriendRequest,
		acceptFriendRequest,
		rejectFriendRequest,
		withdrawFriendRequest,
		removeFriend,
	} = useUserStore()
	const { coalitions } = useCoalitionStore()

	const [login, setLogin] = useState<string | null>(null)
	const [preferences, setPreferences] = useState<ProfilePreferences>(defaultPreferences)
	const [isEditModalOpen, setIsEditModalOpen] = useState(false)
	const loadedFriendsLoginRef = useRef<string | null>(null)
	const routeParams = useParams<{ login?: string }>()

	useEffect(() => {
		if (typeof routeParams.login === 'string' && routeParams.login.length > 0) {
			setLogin(routeParams.login)
			return
		}

		if (params) {
			params.then((p) => {
				setLogin(p.login)
			})
		}
	}, [params, routeParams.login])

	const isOwnProfile = useMemo(() => {
		if (!user || !login) return false

		return user.login.toLowerCase() === login.toLowerCase()
	}, [login, user])

	useEffect(() => {
		if (login && !isOwnProfile) {
			void getUserDetails(login)
		}
	}, [getUserDetails, isOwnProfile, login])

	useEffect(() => {
		if (!user || !login) {
			return
		}

		const normalizedLogin = login.toLowerCase()
		if (loadedFriendsLoginRef.current === normalizedLogin) {
			return
		}

		loadedFriendsLoginRef.current = normalizedLogin
		void getMyFriends()
	}, [getMyFriends, login, user])

	useEffect(() => {
		if (isOwnProfile && user) {
			void getMyAchievements()
		}
	}, [getMyAchievements, isOwnProfile, user])

	const friendRequestState = useMemo<'none' | 'sent' | 'received' | 'friends'>(() => {
		if (!login || isOwnProfile || !friends) {
			return 'none'
		}

		return getRelationshipStateByLogin(login)
	}, [friends, getRelationshipStateByLogin, isOwnProfile, login])

	const profile = useMemo<UserProfileView | null>(() => {
		if (!login) {
			return null
		}

		if (isOwnProfile && user) {
			return {
				name: user.username ?? '',
				login: user.login ?? '',
				email: user.email ?? '',
				avatar: user.avatar ?? '',
				coalition: user.coalition ?? '',
				level: user.intraLevel ?? 0,
				points: user.coalitionPoints ?? 0,
				wallet: user.walletAmount ?? 0,
				evalPoints: user.evalPoints ?? 0,
				campusRank: user.campusUserRank ?? null,
				coalitionRank: user.coalitionUserRank ?? null,
			}
		}

		if (!isOwnProfile && fetchedUser && fetchedUser.login.toLowerCase() === login.toLowerCase()) {
			return {
				name: fetchedUser.displayName ?? '',
				login: fetchedUser.login ?? '',
				email: 'private@campus42.fr',
				avatar: fetchedUser.avatar ?? '',
				coalition: fetchedUser.coalitionSlug ?? fetchedUser.coalitionName ?? '',
				level: fetchedUser.level ?? 0,
				points: fetchedUser.coalitionPoints ?? 0,
				wallet: 0,
				evalPoints: 0,
				campusRank: fetchedUser.campusRank ?? null,
				coalitionRank: fetchedUser.coalitionRank ?? null,
			}
		}

		return null
	}, [fetchedUser, isOwnProfile, login, user])

	const currentAchievements = useMemo(() => achievements?.achievements ?? [], [achievements?.achievements])
	const friendAchievements = useMemo(
		() => fetchedUser?.achievements?.achievements ?? null,
		[fetchedUser?.achievements?.achievements]
	)

	const coalitionColor = useMemo(() => {
		if (!profile?.coalition) {
			return '#00BABC'
		}

		const coalition = coalitions.find(
			(item) => item.slug.toLowerCase() === profile.coalition.toLowerCase() || item.name.toLowerCase() === profile.coalition.toLowerCase()
		)

		return coalition?.color || '#00BABC'
	}, [coalitions, profile?.coalition])

	const coalitionStyle = {
		'--coalition-color': coalitionColor,
	} as CSSProperties

	const normalizedLevel = Math.max(profile?.level ?? 0, 0)
	const currentLevel = Math.floor(normalizedLevel)
	const nextLevel = currentLevel + 1
	const levelProgress = (normalizedLevel - currentLevel) * 100

	if (!login || isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<p className="text-sm text-text-secondary">Cargando perfil...</p>
			</div>
		)
	}

	if (!profile) {
		return (
			<div className="flex items-center justify-center h-64">
				<p className="text-sm text-text-secondary">
					{error ?? 'Usuario no encontrado.'}
				</p>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4 my-8" style={coalitionStyle}>
			<div className="flex items-center justify-between">
				<Link href="/leaderboard" className="flex items-center gap-2 text-text-secondary hover:text-text transition-colors">
					<ArrowLeft size={20} />
					Volver a Leaderboard
				</Link>
			</div>
			<UserProfile
				profile={profile}
				coalitionColor={coalitionColor}
				currentLevel={currentLevel}
				nextLevel={nextLevel}
				levelProgress={levelProgress}
				isOwnProfile={isOwnProfile}
				friendRequestState={friendRequestState}
				onLogout={isOwnProfile ? () => void logout() : undefined}
				onOpenPreferences={isOwnProfile ? () => setIsEditModalOpen(true) : undefined}
				onSendFriendRequest={
					!isOwnProfile
						? () => {
							if (login) {
								void sendFriendRequest(login)
							}
						}
						: undefined
				}
				onWithdrawFriendRequest={
					!isOwnProfile
						? () => {
							if (login) {
								void withdrawFriendRequest(login)
							}
						}
						: undefined
				}
				onAcceptFriendRequest={
					!isOwnProfile
						? () => {
							if (login) {
								void acceptFriendRequest(login)
							}
						}
						: undefined
				}
				onRejectFriendRequest={
					!isOwnProfile
						? () => {
							if (login) {
								void rejectFriendRequest(login)
							}
						}
						: undefined
				}
				onRemoveFriend={
					!isOwnProfile
						? () => {
							if (login) {
								void removeFriend(login)
							}
						}
						: undefined
				}
			/>
			{!isOwnProfile && isFriendsLoading && (
				<p className="px-6 text-xs text-text-secondary">Actualizando estado de amistad...</p>
			)}

			<section className="grid gap-6 px-6 lg:grid-cols-2">
				{isOwnProfile && (
					<>
						<UserAllies currentLogin={profile.login} />
						<UserAchievements achievements={currentAchievements} />
					</>
				)}
				{!isOwnProfile && friendRequestState === 'friends' && fetchedUser && (
					<UserAchievementsComparison
						currentAchievements={currentAchievements}
						friendLogin={fetchedUser.login}
						friendDisplayName={fetchedUser.displayName}
						friendAchievements={friendAchievements}
					/>
				)}
			</section>

			{isOwnProfile && (
				<UserConfigurationModal
					isOpen={isEditModalOpen}
					preferences={preferences}
					onClose={() => setIsEditModalOpen(false)}
					onSave={(nextPreferences) => {
						setPreferences(nextPreferences)
						setIsEditModalOpen(false)
					}}
				/>
			)}
		</div>
	)
}
