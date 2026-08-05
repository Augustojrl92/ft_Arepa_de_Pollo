"use client";
import { MessageCircleIcon } from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import useChatSocket from "@/hooks/useChatSocket";
// import { useChatNotifications } from "@/hooks/useChatSocket";
import useConversations from "@/hooks/useConversations";
import ChatWindow from "@/components/ChatWindow";
import NewChatModal from "@/components/NewChatModal";
import { ChatMessage, ChatConversation, ChatUser } from "@/types";
import { useAuthStore } from "@/hooks";
import { fetchMessagesWith } from "@/lib/chatApi";

export default function Chat() {
	const { user } = useAuthStore();
	const myLogin = user?.login;
	const [open, setOpen] = useState(false);
	const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
	const [isNewChatOpen, setIsNewChatOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [newMessage, setNewMessage] = useState("");
	const [unreadMessages, setUnreadMessages] = useState(0);
	const [friends, setFriends] = useState<ChatUser[]>([]);
	const { conversations, setConversations } = useConversations(myLogin);
	// const { notifications } = useChatNotifications();

	const handleMessageReceived = useCallback((notification: { fromUserId: number }) => {
		setUnreadMessages((current) => {
			if (open && selectedConversationId === notification.fromUserId) {
				return current;
			}

			return current + 1;
		});
	}, [open, selectedConversationId]);
	const { socketRef, sendMessage } = useChatSocket(myLogin, setFriends, selectedConversationId, setConversations, {
		onMessageReceived: handleMessageReceived,
	});

	const conversationsWithStatus = useMemo(() => {
		const statusByLogin = new Map(friends.map((friend) => [friend.login, friend.status]));
		return conversations.map((conversation) => ({
			...conversation,
			status: statusByLogin.get(conversation.login) ?? conversation.status,
		}));
	}, [conversations, friends]);

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
			isTyping: false,
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
		setUnreadMessages(0);
		const conv = conversations.find((c) => c.id === conversationId);
		if (!conv || conv.messages.length > 0) return;

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

	const handleTyping = () => {
		const selectedConversation = conversations.find(
			(conversation) => conversation.id === selectedConversationId,
		);
		if (!selectedConversation) return;
		if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify({
				type: 'typing',
				to_user_id: selectedConversation.id,
				to_user_login: selectedConversation.login,
			}));
			console.log('Se envió el socket de "escribiendo" a', selectedConversation.login);
		}
	};

	const handleSendMessage = (to_user_id: number, to_user_login: string, message: string) => {
		sendMessage({
			type: 'chat_message',
			to_user_id: to_user_id,
			to_user_login: to_user_login,
			message: message,
			timestamp: new Date().toISOString(),
		});
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
	};

	return (
		<>
			<button
				type="button"
				className={open ? "toggle-button is-hidden" : "toggle-button"}
				aria-label="Abrir chat"
				onClick={() => {
					setOpen(true);
					setUnreadMessages(0);
				}}
			>
				<MessageCircleIcon size={28} color="var(--color-card)" />
				{unreadMessages > 0 && (
					<span className="chat-notification-badge" aria-label={`${unreadMessages} mensajes nuevos`}>
						{unreadMessages > 9 ? "9+" : unreadMessages}
					</span>
				)}
			</button>

			<ChatWindow
				open={open}
				onClose={handleClose}
				selectedConversationId={selectedConversationId}
				onSelectConversation={handleSelectConversation}
				onBack={() => setSelectedConversationId(null)}
				conversations={conversationsWithStatus}
				onOpenNewChat={() => {
					if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
						socketRef.current.send(JSON.stringify({ type: 'refresh_friends' }));
					}
					setIsNewChatOpen(true);
				}}
				newMessage={newMessage}
				onNewMessageChange={setNewMessage}
				onSendMessage={handleSendMessage}
				onTyping={handleTyping}
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