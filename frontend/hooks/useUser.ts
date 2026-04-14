'use client'

import { create } from "zustand"
import {
	createFriendRequest,
	fetchMyPreferences,
	fetchMyFriends,
	fetchMyPendingFriendRequests,
	fetchUserDetails,
	removeFriend,
	removeMyAvatar,
	resolveFriendRequest,
	updateMyPreferences,
	uploadMyAvatar,
	withdrawFriendRequest,
} from "@/lib/userApi"
import { FriendsPayload, UserDetails } from "@/types"
import type { ProfilePreferences } from "@/app/users/_components/types"

type FriendRequestState = 'none' | 'sent' | 'received' | 'friends'

interface UserState {
	user: UserDetails | null
	friends: FriendsPayload | null
	isLoading: boolean
	isFriendsLoading: boolean
	isAvatarLoading: boolean
	isPreferencesLoading: boolean
	error: string | null
	avatarError: string | null
	preferencesError: string | null
	hasCustomAvatar: boolean
	getUserDetails: (login: string) => Promise<void>
	getMyFriends: () => Promise<void>
	getMyPreferences: () => Promise<ProfilePreferences>
	updatePreferences: (preferences: ProfilePreferences) => Promise<ProfilePreferences>
	setHasCustomAvatar: (value: boolean) => void
	refreshPendingRequests: () => Promise<void>
	sendFriendRequest: (login: string) => Promise<void>
	acceptFriendRequest: (login: string) => Promise<void>
	rejectFriendRequest: (login: string) => Promise<void>
	withdrawFriendRequest: (login: string) => Promise<void>
	removeFriend: (login: string) => Promise<void>
	uploadAvatar: (file: File) => Promise<string>
	removeAvatar: () => Promise<string>
	getRelationshipStateByLogin: (login: string) => FriendRequestState
}

export const useUserStore = create<UserState>()(
	(set, get) => ({
		user: null,
		friends: null,
		isLoading: false,
		isFriendsLoading: false,
		isAvatarLoading: false,
		isPreferencesLoading: false,
		error: null,
		avatarError: null,
		preferencesError: null,
		hasCustomAvatar: false,

		getUserDetails: async (login) => {
			set({ isLoading: true, error: null })
			try {
				const userDetails = await fetchUserDetails(login)
				set({ user: userDetails, isLoading: false })
			} catch {
				set({ error: 'Failed to fetch user details', isLoading: false })
			}
		},

		getMyFriends: async () => {
			set({ isFriendsLoading: true, error: null })
			try {
				const friends = await fetchMyFriends()
				set({ friends, isFriendsLoading: false })
			} catch {
				set({ error: 'Failed to fetch friends', isFriendsLoading: false })
			}
		},

		getMyPreferences: async () => {
			set({ isPreferencesLoading: true, preferencesError: null })
			try {
				const preferences = await fetchMyPreferences()
				set({ isPreferencesLoading: false })
				return preferences
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to fetch preferences'
				set({ preferencesError: message, isPreferencesLoading: false })
				throw err
			}
		},

		updatePreferences: async (preferences) => {
			set({ isPreferencesLoading: true, preferencesError: null })
			try {
				const savedPreferences = await updateMyPreferences(preferences)
				set({ isPreferencesLoading: false })
				return savedPreferences
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to update preferences'
				set({ preferencesError: message, isPreferencesLoading: false })
				throw err
			}
		},

		setHasCustomAvatar: (value) => {
			set({ hasCustomAvatar: value })
		},

		refreshPendingRequests: async () => {
			set({ isFriendsLoading: true, error: null })
			try {
				const pending = await fetchMyPendingFriendRequests()
				set((state) => ({
					friends: state.friends
						? {
							...state.friends,
							pendingReceivedCount: pending.pendingReceivedCount,
							pendingSentCount: pending.pendingSentCount,
							pendingReceived: pending.pendingReceived,
							pendingSent: pending.pendingSent,
						}
						: pending,
					isFriendsLoading: false,
				}))
			} catch {
				set({ error: 'Failed to fetch pending friend requests', isFriendsLoading: false })
			}
		},

		sendFriendRequest: async (login) => {
			set({ isFriendsLoading: true, error: null })
			try {
				const friends = await createFriendRequest(login)
				set({ friends, isFriendsLoading: false })
			} catch (err) {
				set({ error: err instanceof Error ? err.message : 'Failed to send friend request', isFriendsLoading: false })
			}
		},

		acceptFriendRequest: async (login) => {
			set({ isFriendsLoading: true, error: null })
			try {
				const friends = await resolveFriendRequest(login, 'accept')
				set({ friends, isFriendsLoading: false })
			} catch (err) {
				set({ error: err instanceof Error ? err.message : 'Failed to accept friend request', isFriendsLoading: false })
			}
		},

		rejectFriendRequest: async (login) => {
			set({ isFriendsLoading: true, error: null })
			try {
				const friends = await resolveFriendRequest(login, 'reject')
				set({ friends, isFriendsLoading: false })
			} catch (err) {
				set({ error: err instanceof Error ? err.message : 'Failed to reject friend request', isFriendsLoading: false })
			}
		},

		withdrawFriendRequest: async (login) => {
			set({ isFriendsLoading: true, error: null })
			try {
				const friends = await withdrawFriendRequest(login)
				set({ friends, isFriendsLoading: false })
			} catch (err) {
				set({ error: err instanceof Error ? err.message : 'Failed to withdraw friend request', isFriendsLoading: false })
			}
		},

		removeFriend: async (login) => {
			set({ isFriendsLoading: true, error: null })
			try {
				const friends = await removeFriend(login)
				set({ friends, isFriendsLoading: false })
			} catch (err) {
				set({ error: err instanceof Error ? err.message : 'Failed to remove friend', isFriendsLoading: false })
			}
		},

		uploadAvatar: async (file) => {
			set({ isAvatarLoading: true, avatarError: null })
			try {
				const avatarResult = await uploadMyAvatar(file)
				set({ isAvatarLoading: false, hasCustomAvatar: avatarResult.hasCustomAvatar })
				const avatarUrl = avatarResult.avatarUrl
				return avatarUrl
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to upload avatar'
				set({ avatarError: message, isAvatarLoading: false })
				throw err
			}
		},

		removeAvatar: async () => {
			set({ isAvatarLoading: true, avatarError: null })
			try {
				const avatarResult = await removeMyAvatar()
				set({ isAvatarLoading: false, hasCustomAvatar: avatarResult.hasCustomAvatar })
				const avatarUrl = avatarResult.avatarUrl
				return avatarUrl
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to remove avatar'
				set({ avatarError: message, isAvatarLoading: false })
				throw err
			}
		},

		getRelationshipStateByLogin: (login) => {
			const state = get()
			const normalizedLogin = login.toLowerCase()

			if (!state.friends) {
				return 'none'
			}

			const isFriend = (state.friends.friends ?? []).some((entry) => entry.login.toLowerCase() === normalizedLogin)
			if (isFriend) {
				return 'friends'
			}

			const isSent = state.friends.pendingSent.some((entry) => entry.login.toLowerCase() === normalizedLogin)
			if (isSent) {
				return 'sent'
			}

			const isReceived = state.friends.pendingReceived.some((entry) => entry.login.toLowerCase() === normalizedLogin)
			return isReceived ? 'received' : 'none'
		},
	})
)