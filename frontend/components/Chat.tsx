"use client";

import { ArrowLeftIcon, MessageCircleIcon, PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import { fetchMessagesWith } from "@/lib/chatApi";
import { useAuthStore } from "@/hooks";

type ChatMessage = {
	id: number;
	author: "me" | "friend";
	text: string;
	time: string;
};

type ChatConversation = {
	id: number;
	name: string;
	login: string;
	status: string;
	lastMessage: string;
	lastTime: string;
	messages: ChatMessage[];
};

type ChatUser = {
	id: number;
	name: string;
	login: string;
	status: string;
};

type ChatWindowProps = {
	open: boolean;
	onClose: () => void;
	selectedConversationId: number | null;
	onSelectConversation: (conversationId: number) => void;
	onBack: () => void;
	conversations: ChatConversation[];
	onOpenNewChat: () => void;
	newMessage: string;
	onNewMessageChange: (value: string) => void;
	onSendMessage: (to_user_id: number, to_user_login: string, message: string) => void;
};

function NewChatModal({
	open,
	onClose,
	users,
	searchTerm,
	onSearchChange,
	onSelectUser,
}: {
	open: boolean;
	onClose: () => void;
	users: ChatUser[];
	searchTerm: string;
	onSearchChange: (value: string) => void;
	onSelectUser: (user: ChatUser) => void;
}) {
	if (!open) {
		return null;
	}

	return (
		<div className="new-chat-modal-overlay" role="presentation">
			<div className="new-chat-modal" role="dialog" aria-modal="true" aria-label="Iniciar nuevo chat">
				<div className="new-chat-modal-header">
					<strong>Iniciar nuevo chat</strong>
					<button type="button" className="new-chat-modal-close" onClick={onClose} aria-label="Cerrar nueva conversación">
						<XIcon size={18} />
					</button>
				</div>
				<p className="new-chat-modal-description">Busca el usuario con el que quieras iniciar una conversación.</p>
				<input
					type="text"
					className="new-chat-search"
					placeholder="Buscar usuario..."
					value={searchTerm}
					onChange={(event) => onSearchChange(event.target.value)}
				/>
				<div className="new-chat-user-list">
					{users.map((user) => (
						<button
							key={user.id}
							type="button"
							className="new-chat-user-item"
							onClick={() => onSelectUser(user)}
						>
							<div>
								<strong>{user.name}</strong>
								<div className="chat-list-status">{user.status}</div>
								<div className="text-sm text-text-secondary">{user.login}</div>
							</div>
						</button>
					))}
					{users.length === 0 ? <p className="new-chat-empty">No se encontraron usuarios.</p> : null}
				</div>
			</div>
		</div>
	);
}

function ChatWindow({
	open,
	onClose,
	selectedConversationId,
	onSelectConversation,
	onBack,
	conversations,
	onOpenNewChat,
	newMessage,
	onNewMessageChange,
	onSendMessage,
}: ChatWindowProps) {
	const selectedConversation = conversations.find(
		(conversation) => conversation.id === selectedConversationId,
	);

	return (
		<div className={open ? "chat-container is-open" : "chat-container"}>
			<div className="chat-header">
				<div className="chat-header-actions">
					{selectedConversation ? (
						<button type="button" className="chat-back-button" aria-label="Volver a conversaciones" onClick={onBack}>
							<ArrowLeftIcon size={18} />
						</button>
					) : null}
					<div>
						<div className="header-title">{selectedConversation ? selectedConversation.name : "Mensajes"}</div>
						{selectedConversation ? (
							<div className="chat-subtitle">{selectedConversation.status}</div>
						) : (
							<div className="chat-subtitle">Tus conversaciones recientes</div>
						)}
					</div>
				</div>
				<div className="chat-header-buttons">
					<button type="button" className="chat-new-button" aria-label="Iniciar nuevo chat" onClick={onOpenNewChat}>
						<PlusIcon size={18} />
					</button>
					<button type="button" className="chat-close-button" aria-label="Cerrar chat" onClick={onClose}>
						<XIcon size={18} />
					</button>
				</div>
			</div>
			<div className="chat-body">
				{selectedConversation ? (
					<div className="chat-thread-container">
						<div className="chat-thread">
							{selectedConversation.messages.map((message) => (
								<div
									key={message.id}
									className={message.author === "me" ? "chat-message is-me" : "chat-message is-friend"}
								>
									<p>{message.text}</p>
									<span>{message.time}</span>
								</div>
							))}
						</div>
						<div className="chat-composer">
							<textarea
								value={newMessage}
								onChange={(event) => onNewMessageChange(event.target.value)}
								placeholder="Escribe un mensaje..."
							/>
							<button type="button" className="chat-send-button" onClick={() => {
								if (selectedConversation && newMessage.trim()) {
									onSendMessage(selectedConversation.id, selectedConversation.login, newMessage);
									onNewMessageChange("");
								}
							}}>
								Enviar
							</button>
						</div>
					</div>
				) : (
					<div className="chat-list">
						{conversations.map((conversation) => (
							<button
								key={conversation.id}
								type="button"
								className="chat-list-item"
								onClick={() => onSelectConversation(conversation.id)}
							>
								<div className="chat-avatar">{conversation.name.slice(0, 1)}</div>
								<div className="chat-list-content">
									<div className="chat-list-row">
										<strong>{conversation.name}</strong>
										<span>{conversation.lastTime}</span>
									</div>
									<div className="chat-list-status">{conversation.status}</div>
									<p>{conversation.lastMessage}</p>
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export default function Chat() {
	const { user } = useAuthStore();
	const myLogin = user?.login;
	const [open, setOpen] = useState(false);
	const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
	const [conversations, setConversations] = useState<ChatConversation[]>([]);
	const [isNewChatOpen, setIsNewChatOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [newMessage, setNewMessage] = useState("");
	const [friends, setFriends] = useState<ChatUser[]>([]);
	const socketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAA")
		let isCleaningUp = false;
		const chatSocket = new WebSocket(`ws://localhost:8000/ws/chat/`);
		socketRef.current = chatSocket;

		chatSocket.onopen = () => console.log('Conectado al chat WebSocket');
			chatSocket.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data);

			if (data.type === 'friends_list') {
				const friendsList = data.friends?.friends ?? [];  // <- nota el .friends anidado
				const mappedFriends: ChatUser[] = friendsList.map((friend: any) => ({
					id: friend.user_id,
					name: friend.display_name,
					login: friend.login,
					status: friend.active ? 'En línea' : 'Desconectado',
				}));
				setFriends(mappedFriends);
			}

			if (data.type === 'message') {
				setConversations((prev) => {
					const exists = prev.some((conv) => conv.id === data.from_user_id);
					const newMessage: ChatMessage = {
						id: Date.now(),
						author: 'friend',
						text: data.message,
						time: new Date(data.timestamp).toLocaleTimeString(),
					};

					if (exists) {
						return prev.map((conv) =>
							conv.id === data.from_user_id
								? {
									...conv,
									messages: [...conv.messages, newMessage],
									lastMessage: data.message,
									lastTime: newMessage.time,
								}
								: conv
						);
					}

					return [
						{
							id: data.from_user_id,
							name: data.from_username,
							login: data.from_username,
							status: 'En línea',
							lastMessage: data.message,
							lastTime: newMessage.time,
							messages: [newMessage],
						},
						...prev,
					];
				});
				return;
			}

			if (data.type === 'status_update') {
				setFriends((prev) =>
					prev.map((friend) =>
						friend.id === data.user_id
							? { ...friend, status: data.status === 'online' ? 'En línea' : 'Desconectado' }
							: friend
					)
				);
			}
		} catch (err) {
			console.error('Error parsing WS message:', err);
		}
	};
		chatSocket.onerror = (error) => {
			if (isCleaningUp) return; // ignora el error esperado del cleanup de StrictMode
			console.error('Error WebSocket:', error);
		};
		chatSocket.onclose = (event) => console.log('Desconectado del chat', event.code, event.reason);

		return () => {
			isCleaningUp = true;
			if (chatSocket.readyState === WebSocket.OPEN || chatSocket.readyState === WebSocket.CONNECTING) {
				chatSocket.close();
			}
		};
	}, []);

	const filteredUsers = useMemo(() => {
		const normalizedTerm = searchTerm.trim().toLowerCase();
		if (!normalizedTerm) {
			return friends;
		}

		return friends.filter((user) => {
			const haystack = `${user.name} ${user.login} ${user.status}`.toLowerCase();
			return haystack.includes(normalizedTerm);
		});
	}, [searchTerm, friends]);

	const handleClose = () => {
		setOpen(false);
		setSelectedConversationId(null);
		setIsNewChatOpen(false);
		setNewMessage("");
	};

	const handleStartConversation = async (chatUser: ChatUser) => {
		const existing = conversations.find(
			(conversation) => conversation.id === chatUser.id || conversation.login === chatUser.login
		);
		setIsNewChatOpen(false);
		setSearchTerm("");

		if (existing) {
			await handleSelectConversation(existing.id);
			return;
		}
		const newConversation: ChatConversation = {
			id: chatUser.id,
			name: chatUser.name,
			login: chatUser.login,
			status: chatUser.status,
			lastMessage: "",
			lastTime: "Ahora",
			messages: [],
		};

		setConversations((prev) => [newConversation, ...prev]);
		setSelectedConversationId(chatUser.id);
		try {
			const history = await fetchMessagesWith(chatUser.login);
			if (history.length === 0) return;

			const mappedMessages: ChatMessage[] = history.map((row, index) => ({
				id: index,
				author: row.sender_login === myLogin ? 'me' : 'friend',
				text: row.message,
				time: new Date(row.date_time).toLocaleTimeString(),
			}));

			setConversations((prev) =>
				prev.map((c) =>
					c.id === chatUser.id ? { ...c, messages: mappedMessages } : c
				)
			);
		} catch (err) {
			console.error('Error cargando historial:', err);
		}
	};
	const handleSelectConversation = async (conversationId: number) => {
		setSelectedConversationId(conversationId);

		const conv = conversations.find((c) => c.id === conversationId);
		if (!conv || conv.messages.length > 0) return; // ya cargado

		try {
			const history = await fetchMessagesWith(conv.login);
			const mappedMessages: ChatMessage[] = history.map((row, index) => ({
				id: index,
				author: row.sender_login === myLogin ? 'me' : 'friend',
				text: row.message,
				time: new Date(row.date_time).toLocaleTimeString(),
			}));

			setConversations((prev) =>
				prev.map((c) =>
					c.id === conversationId ? { ...c, messages: mappedMessages } : c
				)
			);
		} catch (err) {
			console.error('Error cargando historial:', err);
		}
	};
	const handleSendMessage = (to_user_id: number, to_user_login: string, message: string) => {
		if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify({
				type: 'chat_message',
				to_user_id: to_user_id,
				to_user_login: to_user_login,
				message: message,
				timestamp: new Date().toISOString()
			}));

			setConversations((prev) =>
				prev.map((conv) => {
					if (conv.id === to_user_id) {
						return {
							...conv,
							messages: [
								...conv.messages,
								{
									id: conv.messages.length + 1,
									author: 'me',
									text: message,
									time: new Date().toLocaleTimeString(),
								},
							],
							lastMessage: message,
							lastTime: new Date().toLocaleTimeString(),
						};
					}
					return conv;
				})
			);
		} else {
			console.error('WebSocket no está conectado');
		}
	};
	return (
		<>
			<button
				type="button"
				className={open ? "toggle-button is-hidden" : "toggle-button"}
				aria-label="Abrir chat"
				onClick={() => setOpen(true)}
			>
				<MessageCircleIcon size={28} color="var(--color-card)" />
			</button>
			<ChatWindow
				open={open}
				onClose={handleClose}
				selectedConversationId={selectedConversationId}
				onSelectConversation={handleSelectConversation}
				onBack={() => setSelectedConversationId(null)}
				conversations={conversations}
				onOpenNewChat={() => setIsNewChatOpen(true)}
				newMessage={newMessage}
				onNewMessageChange={setNewMessage}
				onSendMessage={handleSendMessage}
			/>
			<NewChatModal
				open={isNewChatOpen}
				onClose={() => setIsNewChatOpen(false)}
				users={filteredUsers}
				searchTerm={searchTerm}
				onSearchChange={setSearchTerm}
				onSelectUser={handleStartConversation}
			/>
		</>
	);
}
