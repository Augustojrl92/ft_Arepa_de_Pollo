"use client";

import { ArrowLeftIcon, MessageCircleIcon, PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

type ChatMessage = {
	id: number;
	author: "me" | "friend";
	text: string;
	time: string;
};

type ChatConversation = {
	id: number;
	name: string;
	status: string;
	lastMessage: string;
	lastTime: string;
	messages: ChatMessage[];
};

type ChatUser = {
	id: number;
	name: string;
	status: string;
};

const mockUsers: ChatUser[] = [
	{ id: 1, name: "aurodrig", status: "En linea" },
	{ id: 2, name: "fvizcaya", status: "Ausente" },
	{ id: 3, name: "fmorenil", status: "Desconectada" },
];

const mockConversations: ChatConversation[] = [
	{
		id: 1,
		name: "aurodrig",
		status: "En linea",
		lastMessage: "5",
		lastTime: "09:12",
		messages: [
			{ id: 1, author: "friend", text: "viva caracas", time: "09:03" },
			{ id: 2, author: "me", text: "2 + 3", time: "09:05" },
			{ id: 3, author: "friend", text: "5.", time: "09:12" },
		],
	},
	{
		id: 2,
		name: "fvizcaya",
		status: "Ausente",
		lastMessage: "La API de coalitions ya responde bien.",
		lastTime: "Ayer",
		messages: [
			{ id: 1, author: "me", text: "ggc", time: "Ayer" },
			{ id: 2, author: "friend", text: "cd /", time: "Ayer" },
			{ id: 3, author: "me", text: "ggc.", time: "Ayer" },
		],
	},
	{
		id: 3,
		name: "fmorenil",
		status: "Desconectada",
		lastMessage: "hablamo el malte",
		lastTime: "Lun",
		messages: [
			{ id: 1, author: "friend", text: "estaba jalandome el guebo", time: "Lun" },
			{ id: 2, author: "me", text: "wao", time: "Lun" },
			{ id: 3, author: "friend", text: "hablamo el malte", time: "Lun" },
		],
	},
];

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
		<div className="new-chat-modal-overlay">
			<div className="new-chat-modal">
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
							<button type="button" className="chat-send-button" onClick={() => onNewMessageChange("")}>
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
	const [open, setOpen] = useState(false);
	const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
	const [conversations, setConversations] = useState<ChatConversation[]>(mockConversations);
	const [isNewChatOpen, setIsNewChatOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [newMessage, setNewMessage] = useState("");

	const filteredUsers = useMemo(
		() =>
			mockUsers.filter((user) =>
				user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				user.status.toLowerCase().includes(searchTerm.toLowerCase()),
			),
		[searchTerm],
	);

	const handleClose = () => {
		setOpen(false);
		setSelectedConversationId(null);
		setIsNewChatOpen(false);
		setNewMessage("");
	};

	const handleStartConversation = (user: ChatUser) => {
		const existing = conversations.find((conversation) => conversation.name === user.name);
		if (existing) {
			setSelectedConversationId(existing.id);
		} else {
			const nextId = Math.max(0, ...conversations.map((conversation) => conversation.id)) + 1;
			const newConversation: ChatConversation = {
				id: nextId,
				name: user.name,
				status: user.status,
				lastMessage: "",
				lastTime: "Ahora",
				messages: [],
			};
			setConversations((prev) => [...prev, newConversation]);
			setSelectedConversationId(nextId);
		}
		setIsNewChatOpen(false);
		setSearchTerm("");
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
				onSelectConversation={setSelectedConversationId}
				onBack={() => setSelectedConversationId(null)}
				conversations={conversations}
				onOpenNewChat={() => setIsNewChatOpen(true)}
				newMessage={newMessage}
				onNewMessageChange={setNewMessage}
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
