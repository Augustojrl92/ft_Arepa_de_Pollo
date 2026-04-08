import { FriendsPayload, UserDetails } from '@/types';
import { authFetchJson } from './authApi';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const USER_BASE_URL = `${API_URL}/api/users/`;

type UserDetailsResponse = {
	id: number;
	login: string;
	display_name: string;
	avatar_url: string;
	level: number;
	coalition_name: string;
	coalition_slug: string;
	coalition_points: number;
	coalition_rank: number | null;
	general_rank: number | null;
	achievements: any; // Placeholder for achievements data, adjust type as needed
}

type FriendEntryResponse = {
	user_id: number;
	username: string;
	login: string;
	display_name: string;
	avatar_url: string;
}

type FriendsPayloadResponse = {
	owner_user_id: number;
	friends_count?: number;
	pending_received_count: number;
	pending_sent_count: number;
	friends?: FriendEntryResponse[];
	pending_received: FriendEntryResponse[];
	pending_sent: FriendEntryResponse[];
}

type FriendsActionResponse = {
	detail: string;
	friends: FriendsPayloadResponse;
}

const toFriendsPayload = (payload: FriendsPayloadResponse): FriendsPayload => ({
	ownerUserId: payload.owner_user_id,
	friendsCount: payload.friends_count,
	pendingReceivedCount: payload.pending_received_count,
	pendingSentCount: payload.pending_sent_count,
	friends: (payload.friends ?? []).map((friend) => ({
		userId: friend.user_id,
		username: friend.username,
		login: friend.login,
		displayName: friend.display_name,
		avatarUrl: friend.avatar_url,
	})),
	pendingReceived: payload.pending_received.map((friend) => ({
		userId: friend.user_id,
		username: friend.username,
		login: friend.login,
		displayName: friend.display_name,
		avatarUrl: friend.avatar_url,
	})),
	pendingSent: payload.pending_sent.map((friend) => ({
		userId: friend.user_id,
		username: friend.username,
		login: friend.login,
		displayName: friend.display_name,
		avatarUrl: friend.avatar_url,
	})),
});

export async function fetchUserDetails(login: string): Promise<UserDetails> {
	const payload = await authFetchJson<UserDetailsResponse>(`${USER_BASE_URL}details/?login=${encodeURIComponent(login)}`, {
		method: 'GET',
	}, "Failed to fetch user details");

	return {
		id: payload.id,
		login: payload.login,
		displayName: payload.display_name,
		avatar: payload.avatar_url,
		level: payload.level,
		coalitionName: payload.coalition_name,
		coalitionSlug: payload.coalition_slug,
		coalitionPoints: payload.coalition_points,
		coalitionRank: payload.coalition_rank,
		campusRank: payload.general_rank,
		achievements: payload.achievements,
	};
}

export async function fetchMyFriends(): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsPayloadResponse>(`${USER_BASE_URL}friends/me/`, {
		method: 'GET',
	}, 'Failed to fetch friends data');

	return toFriendsPayload(payload);
}

export async function fetchMyPendingFriendRequests(): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsPayloadResponse>(`${USER_BASE_URL}friends/pending/`, {
		method: 'GET',
	}, 'Failed to fetch pending friend requests');

	return toFriendsPayload(payload);
}

export async function createFriendRequest(login: string): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsActionResponse>(`${USER_BASE_URL}friends/requests/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ login }),
	}, 'Failed to send friend request');

	return toFriendsPayload(payload.friends);
}

export async function resolveFriendRequest(login: string, action: 'accept' | 'reject'): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsActionResponse>(`${USER_BASE_URL}friends/requests/`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ login, action }),
	}, `Failed to ${action} friend request`);

	return toFriendsPayload(payload.friends);
}

export async function withdrawFriendRequest(login: string): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsActionResponse>(`${USER_BASE_URL}friends/requests/`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ login }),
	}, 'Failed to withdraw friend request');

	return toFriendsPayload(payload.friends);
}

export async function removeFriend(login: string): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsActionResponse>(`${USER_BASE_URL}friends/`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ login }),
	}, 'Failed to remove friend');

	return toFriendsPayload(payload.friends);
}