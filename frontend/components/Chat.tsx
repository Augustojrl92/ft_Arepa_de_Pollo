"use client";

import { ArrowLeftIcon, MessageCircleIcon, XIcon } from "lucide-react";
import { useState } from "react";

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
};

function ChatWindow({ open, onClose, selectedConversationId, onSelectConversation, onBack }: ChatWindowProps)
{
	const selectedConversation = mockConversations.find(
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
						{selectedConversation ? <div className="chat-subtitle">{selectedConversation.status}</div> : <div className="chat-subtitle">Tus conversaciones recientes</div>}
	  			  </div>
				</div>
				<button type="button" className="chat-close-button" aria-label="Cerrar chat" onClick={onClose}>
					<XIcon size={18} />
				</button>
	 			</div>
			<div className="chat-body">
				{selectedConversation ? (
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
				) : (
					<div className="chat-list">
						{mockConversations.map((conversation) => (
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

export default function Chat()
{
	const [open, setOpen] = useState(false);
	const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);

	const handleClose = () => {
		setOpen(false);
		setSelectedConversationId(null);
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
			/>
		</>
	);
}