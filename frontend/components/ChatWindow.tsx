import { ArrowLeftIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useRef, useEffect } from "react";
import { ChatWindowProps } from "@/types";
import { formatDayLabel, getDayKey } from "@/lib/chatFormat";

export default function ChatWindow({
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
  onTyping
}: ChatWindowProps) {
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);
  const threadRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const el = threadRef.current;
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
}, [selectedConversation?.messages, selectedConversation?.isTyping, selectedConversationId]);
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
            {selectedConversation ? (
              <Link href={`/users/${encodeURIComponent(selectedConversation.login)}`} className="header-title header-title-link">
                {selectedConversation.login}
              </Link>
            ) : (
              <div className="header-title">Mensajes</div>
            )}
            {selectedConversation ? (
              <div className="chat-subtitle">{selectedConversation.isTyping ? "Escribiendo..." : selectedConversation.status}</div>
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
            <div className="chat-thread" ref={threadRef}>
              {selectedConversation.messages.map((message, index) => {
                const previousMessage = selectedConversation.messages[index - 1];
                const showDayDivider = !previousMessage || getDayKey(message.date) !== getDayKey(previousMessage.date);
                return (
                  <React.Fragment key={message.id}>
                    {showDayDivider ? <div className="chat-day-divider">{formatDayLabel(message.date)}</div> : null}
                    <div className={message.author === "me" ? "chat-message is-me" : "chat-message is-friend"}>
                      <p>{message.text}</p>
                      <span>{message.time}</span>
                    </div>
                  </React.Fragment>
                );
              })}
              {selectedConversation.isTyping ? (
                <div className="chat-typing-bubble" aria-label={`${selectedConversation.login} está escribiendo`}>
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                </div>
              ) : null}
            </div>
            <div className="chat-composer">
              <textarea
                value={newMessage}
                onChange={(event) => {onNewMessageChange(event.target.value); onTyping()}}
                placeholder="Escribe un mensaje..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (selectedConversation && newMessage.trim()) {
                      onSendMessage(selectedConversation.id, selectedConversation.login, newMessage.trim());
                      onNewMessageChange("");
                    }
                  }
                }}
              />
              <button
                type="button"
                className="chat-send-button"
                onClick={() => {
                  if (selectedConversation && newMessage.trim()) {
                    onSendMessage(selectedConversation.id, selectedConversation.login, newMessage);
                    onNewMessageChange("");
                  }
                }}
              >
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
                <div className="chat-avatar">{conversation.login.slice(0, 1)}</div>
                <div className="chat-list-content">
                  <div className="chat-list-row">
                    <strong>{conversation.login}</strong>
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
