import { FriendsPayload, UserDetails } from '@/types';
import { authFetch, authFetchJson } from './authApi';

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
	achievements: unknown; // Placeholder for achievements data, adjust type as needed
	active?: boolean;
	has_account: boolean;
}

type FriendEntryResponse = {
	user_id: number;
	username: string;
	login: string;
	display_name: string;
	avatar_url: string;
	active: boolean;
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

type AvatarResponse = {
	avatar_url: string;
	has_custom_avatar: boolean;
	detail?: string;
}

type PreferencesResponse = {
	items_per_page: number;
	show_sensitive_data: boolean;
	theme_mode: 'light' | 'dark' | 'system';
	receive_notifications: boolean;
	custom_username: string | null;
	avatar_url: string;
	has_custom_avatar: boolean;
}

type UserPreferencesPayload = {
	rankingPerPage: 10 | 25 | 50 | 100;
	showSensitiveData: boolean;
	notificationsEnabled: boolean;
	theme: 'light' | 'dark' | 'system';
}

type AvatarResult = {
	avatarUrl: string;
	hasCustomAvatar: boolean;
}

type UserPointsHistoryResponse = {
	user: {
		id: number;
		login: string;
		display_name: string;
		coalition_slug: string;
	};
	history: {
		date: string;
		points: number;
		coalition_rank: number | null;
		campus_rank: number | null;
	}[];
}

type UserExportResult = {
	blob: Blob;
	filename: string;
}

const toRankingPerPage = (value: number): 10 | 25 | 50 | 100 => {
	if (value === 10 || value === 25 || value === 50 || value === 100) {
		return value;
	}

	return 25;
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
		active: friend.active,
	})),
	pendingReceived: payload.pending_received.map((friend) => ({
		userId: friend.user_id,
		username: friend.username,
		login: friend.login,
		displayName: friend.display_name,
		avatarUrl: friend.avatar_url,
		active: friend.active,
	})),
	pendingSent: payload.pending_sent.map((friend) => ({
		userId: friend.user_id,
		username: friend.username,
		login: friend.login,
		displayName: friend.display_name,
		avatarUrl: friend.avatar_url,
		active: friend.active,
	})),
});

const parseAttachmentFilename = (contentDisposition: string | null) => {
	if (!contentDisposition) {
		return `aedlph-data-export-${Date.now()}.json`
	}

	const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
	const rawFilename = filenameMatch?.[1] ?? filenameMatch?.[2]

	if (!rawFilename) {
		return `aedlph-data-export-${Date.now()}.json`
	}

	try {
		return decodeURIComponent(rawFilename)
	} catch {
		return rawFilename
	}
}

export async function fetchUserDetails(login: string): Promise<UserDetails> {
	const payload = await authFetchJson<UserDetailsResponse>(`${USER_BASE_URL}details/?login=${encodeURIComponent(login)}`, {
		method: 'GET',
	}, "No se han podido obtener los datos del usuario");

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
		active: Boolean(payload.active),
		hasAccount: payload.has_account
	};
}

export async function fetchMyFriends(): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsPayloadResponse>(`${USER_BASE_URL}friends/me/`, {
		method: 'GET',
	}, 'No se han podido obtener los amigos');

	return toFriendsPayload(payload);
}

export async function fetchMyPendingFriendRequests(): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsPayloadResponse>(`${USER_BASE_URL}friends/pending/`, {
		method: 'GET',
	}, 'No se han podido obtener las solicitudes de amistad pendientes');

	return toFriendsPayload(payload);
}

export async function sendHeartbeat(): Promise<void> {
	const login = window.localStorage.getItem('auth-login')

	try {
		await authFetchJson<{ ok: boolean }>(`${USER_BASE_URL}heartbeat/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ login: login ?? '' }),
		}, 'No se ha podido enviar el heartbeat');
	} catch {
		// Heartbeat is best-effort; a failed request is never worth surfacing.
	}
}

export async function searchFriendRequestUsers(query: string): Promise<Array<{ login: string; displayName: string; avatarUrl: string }>> {
	const payload = await authFetchJson<{ results: Array<{ login: string; display_name: string; avatar_url: string }> }>(`${USER_BASE_URL}friends/requests/?q=${encodeURIComponent(query)}`, {
		method: 'GET',
	}, 'No se han podido buscar usuarios');

	return payload.results.map((result) => ({
		login: result.login,
		displayName: result.display_name,
		avatarUrl: result.avatar_url,
	}))
}

export async function createFriendRequest(login: string): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsActionResponse>(`${USER_BASE_URL}friends/requests/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ login }),
	}, 'No se ha podido enviar la solicitud de amistad');

	return toFriendsPayload(payload.friends);
}

export async function resolveFriendRequest(login: string, action: 'accept' | 'reject'): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsActionResponse>(`${USER_BASE_URL}friends/requests/`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ login, action }),
	}, `No se ha podido ${action === 'accept' ? 'aceptar' : 'rechazar'} la solicitud de amistad`);

	return toFriendsPayload(payload.friends);
}

export async function withdrawFriendRequest(login: string): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsActionResponse>(`${USER_BASE_URL}friends/requests/`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ login }),
	}, 'No se ha podido retirar la solicitud de amistad');

	return toFriendsPayload(payload.friends);
}

export async function removeFriend(login: string): Promise<FriendsPayload> {
	const payload = await authFetchJson<FriendsActionResponse>(`${USER_BASE_URL}friends/`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ login }),
	}, 'No se ha podido eliminar al amigo');

	return toFriendsPayload(payload.friends);
}

export async function uploadMyAvatar(file: File): Promise<AvatarResult> {
	const formData = new FormData();
	formData.append('avatar', file);

	const payload = await authFetchJson<AvatarResponse>(`${USER_BASE_URL}preferences/avatar/`, {
		method: 'PUT',
		body: formData,
	}, 'No se ha podido subir el avatar');

	return {
		avatarUrl: payload.avatar_url,
		hasCustomAvatar: payload.has_custom_avatar,
	};
}

export async function removeMyAvatar(): Promise<AvatarResult> {
	const payload = await authFetchJson<AvatarResponse>(`${USER_BASE_URL}preferences/avatar/`, {
		method: 'DELETE',
	}, 'No se ha podido eliminar el avatar');

	return {
		avatarUrl: payload.avatar_url,
		hasCustomAvatar: payload.has_custom_avatar,
	};
}

export async function fetchMyPreferences(): Promise<UserPreferencesPayload> {
	const payload = await authFetchJson<PreferencesResponse>(`${USER_BASE_URL}preferences/`, {
		method: 'GET',
	}, 'No se han podido obtener las preferencias');

	return {
		rankingPerPage: toRankingPerPage(payload.items_per_page),
		showSensitiveData: payload.show_sensitive_data,
		notificationsEnabled: payload.receive_notifications,
		theme: payload.theme_mode,
	};
}

export async function updateMyPreferences(preferences: UserPreferencesPayload): Promise<UserPreferencesPayload> {
	const payload = await authFetchJson<PreferencesResponse>(`${USER_BASE_URL}preferences/`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			items_per_page: preferences.rankingPerPage,
			show_sensitive_data: preferences.showSensitiveData,
			receive_notifications: preferences.notificationsEnabled,
			theme_mode: preferences.theme,
		}),
	}, 'No se han podido actualizar las preferencias');

	return {
		rankingPerPage: toRankingPerPage(payload.items_per_page),
		showSensitiveData: payload.show_sensitive_data,
		notificationsEnabled: payload.receive_notifications,
		theme: payload.theme_mode,
	};
}

export async function fetchUserPointsHistory(login: string) {
	const payload = await authFetchJson<UserPointsHistoryResponse>(`${USER_BASE_URL}points-history/?login=${encodeURIComponent(login)}`, {
		method: 'GET',
	}, 'No se ha podido obtener el historial de puntos del usuario');

	return {
		user: {
			id: payload.user.id,
			login: payload.user.login,
			displayName: payload.user.display_name,
			coalitionSlug: payload.user.coalition_slug,
		},
		history: payload.history.map((entry) => ({
			date: entry.date,
			points: entry.points,
			coalitionRank: entry.coalition_rank,
			campusRank: entry.campus_rank,
		})),
	};
}

export async function exportMyData(): Promise<UserExportResult> {
	const response = await authFetch(`${USER_BASE_URL}me/export/`, {
		method: 'GET',
	}, 'No se han podido exportar los datos del usuario')

	return {
		blob: await response.blob(),
		filename: parseAttachmentFilename(response.headers.get('content-disposition')),
	}
}

export async function deleteMyAccount(): Promise<{ detail: string }> {
	return authFetchJson<{ detail: string }>(`${USER_BASE_URL}me/`, {
		method: 'DELETE',
	}, 'No se ha podido eliminar la cuenta del usuario')
}
