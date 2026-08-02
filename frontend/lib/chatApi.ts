export async function fetchMessagesWith(login: string) {
	const res = await fetch(`http://localhost:8000/api/chat/messages/${login}/`, {
		credentials: 'include',
	});
	if (!res.ok) throw new Error('Failed to fetch messages');
	const data = await res.json();
	return data.messages as {
		sender_login: string;
		receiver_login: string;
		message: string;
		date_time: string;
	}[];
}