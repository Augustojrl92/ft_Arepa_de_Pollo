'use client'

import { create } from "zustand"
import {
	fetchMyAchievementEvents,
	fetchMyAchievements,
	createFriendRequest,
	fetchMyFriends,
	fetchMyPendingFriendRequests,
	fetchUserDetails,
	removeFriend,
	resolveFriendRequest,
	withdrawFriendRequest,
} from "@/lib/userApi"
import { AchievementEvent, AchievementsPayload, FriendsPayload, UserDetails } from "@/types"

type FriendRequestState = 'none' | 'sent' | 'received' | 'friends'

interface UserState {
	user: UserDetails | null
	achievements: AchievementsPayload | null
	achievementEvents: AchievementEvent[]
	friends: FriendsPayload | null
	isLoading: boolean
	isFriendsLoading: boolean
	error: string | null
	getUserDetails: (login: string) => Promise<void>
	getMyAchievements: () => Promise<void>
	refreshAchievementEvents: () => Promise<AchievementEvent[]>
	getMyFriends: () => Promise<void>
	refreshPendingRequests: () => Promise<void>
	sendFriendRequest: (login: string) => Promise<void>
	acceptFriendRequest: (login: string) => Promise<void>
	rejectFriendRequest: (login: string) => Promise<void>
	withdrawFriendRequest: (login: string) => Promise<void>
	removeFriend: (login: string) => Promise<void>
	getRelationshipStateByLogin: (login: string) => FriendRequestState
}

export const useUserStore = create<UserState>()(
	(set, get) => ({
		user: null,
		achievements: null,
		achievementEvents: [],
		friends: null,
		isLoading: false,
		isFriendsLoading: false,
		error: null,

		getUserDetails: async (login) => {
			set({ isLoading: true, error: null })
			try {
				const userDetails = await fetchUserDetails(login)
				set({ user: userDetails, isLoading: false })
			} catch (err) {
				set({ error: 'Failed to fetch user details', isLoading: false })
			}
		},

		getMyAchievements: async () => {
			try {
				const achievements = await fetchMyAchievements()
				set({ achievements })
			} catch (err) {
				set({ error: 'Failed to fetch achievements' })
			}
		},

		refreshAchievementEvents: async () => {
			try {
				const events = await fetchMyAchievementEvents()
				set((state) => ({
					achievementEvents: [...events, ...state.achievementEvents].slice(0, 50),
				}))
				return events
			} catch (err) {
				set({ error: 'Failed to fetch achievement events' })
				return []
			}
		},

		getMyFriends: async () => {
			set({ isFriendsLoading: true, error: null })
			try {
				const friends = await fetchMyFriends()
				set({ friends, isFriendsLoading: false })
			} catch (err) {
				set({ error: 'Failed to fetch friends', isFriendsLoading: false })
			}
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
			} catch (err) {
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