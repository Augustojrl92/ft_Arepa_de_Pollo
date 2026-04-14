'use client'

import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'

import { useAuthStore, useCoalitionStore, useUserStore } from '@/hooks'
import { UserAchievements } from '../_components/UserAchievements'
import { UserAllies } from '../_components/UserAllies'
import { UserConfigurationModal } from '../_components/UserConfigurationModal'
import { UserProfile } from '../_components/UserProfile'
import { defaultPreferences, mockAchievements } from '../_components/mockData'
import type { ProfilePreferences } from '../_components/types'
import type { UserProfileView } from '../_components/types'


export default function UserDetailPage({
	params,
}: {
	params: Promise<{ login: string }>
}) {
	const { user, logout, setSession } = useAuthStore()
	const {
		user: fetchedUser,
		friends,
		isLoading,
		isAvatarLoading,
		isPreferencesLoading,
		error,
		avatarError,
		preferencesError,
		hasCustomAvatar,
		getUserDetails,
		getMyFriends,
		getMyPreferences,
		updatePreferences,
		setHasCustomAvatar,
		getRelationshipStateByLogin,
		sendFriendRequest,
		acceptFriendRequest,
		rejectFriendRequest,
		withdrawFriendRequest,
		removeFriend,
		uploadAvatar,
		removeAvatar,
	} = useUserStore()
	const { coalitions } = useCoalitionStore()
	const { setTheme } = useTheme()

	const [login, setLogin] = useState<string | null>(null)
	const [preferences, setPreferences] = useState<ProfilePreferences>(defaultPreferences)
	const [isEditModalOpen, setIsEditModalOpen] = useState(false)

	useEffect(() => {
		params.then((p) => {
			setLogin(p.login)
		})
	}, [params])

	const isOwnProfile = useMemo(() => {
		if (!user || !login) return false

		return user.login.toLowerCase() === login.toLowerCase()
	}, [login, user])

	useEffect(() => {
		if (user) {
			void getMyFriends()
		}
	}, [getMyFriends, user])

	useEffect(() => {
		if (user && isOwnProfile) {
			setHasCustomAvatar(Boolean(user.hasCustomAvatar))
		}
	}, [isOwnProfile, setHasCustomAvatar, user])

	useEffect(() => {
		if (!isEditModalOpen || !isOwnProfile) {
			return
		}

		void getMyPreferences().then((serverPreferences) => {
			setPreferences(serverPreferences)
		})
	}, [getMyPreferences, isEditModalOpen, isOwnProfile])

	useEffect(() => {
		if (login && !isOwnProfile) {
			void getUserDetails(login)
		}
	}, [getUserDetails, isOwnProfile, login])

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

	const coalitionColor = useMemo(() => {
		if (!profile?.coalition) {
			return '#00BABC'
		}

		const coalition = coalitions.find(
			(item) => item.slug.toLowerCase() === profile.coalition.toLowerCase() || item.name.toLowerCase() === profile.coalition.toLowerCase()
		)

		return coalition?.color || '#00BABC'
	}, [coalitions, profile])

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
			<section className="grid gap-6 px-6 lg:grid-cols-2">
				{isOwnProfile && (
					<>
						<UserAllies currentLogin={profile.login} />
						<UserAchievements achievements={mockAchievements} />
					</>
				)}
			</section>

			{isOwnProfile && (
				<UserConfigurationModal
					key={`${isEditModalOpen}-${preferences.rankingPerPage}-${preferences.theme}-${preferences.notificationsEnabled}-${preferences.showSensitiveData}`}
					isOpen={isEditModalOpen}
					preferences={preferences}
					avatarUrl={profile.avatar}
					hasCustomAvatar={hasCustomAvatar}
					isAvatarLoading={isAvatarLoading}
					isPreferencesLoading={isPreferencesLoading}
					avatarError={avatarError ?? preferencesError}
					onClose={() => setIsEditModalOpen(false)}
					onSave={async (nextPreferences) => {
						const savedPreferences = await updatePreferences(nextPreferences)
						setPreferences(savedPreferences)
						setTheme(savedPreferences.theme)
						window.localStorage.setItem('leaderboard.defaultPerPage', String(savedPreferences.rankingPerPage))
						setIsEditModalOpen(false)
					}}
					onUploadAvatar={async (file) => {
						const avatarUrl = await uploadAvatar(file)
						if (user) {
							setSession({
								user: {
									...user,
									avatar: avatarUrl,
									hasCustomAvatar: true,
								},
							})
						}
					}}
					onRemoveAvatar={async () => {
						const avatarUrl = await removeAvatar()
						if (user) {
							setSession({
								user: {
									...user,
									avatar: avatarUrl,
									hasCustomAvatar: false,
								},
							})
						}
					}}
				/>
			)}
		</div>
	)
}
