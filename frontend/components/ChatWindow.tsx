import { ArrowLeftIcon, PlusIcon, XIcon } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { ChatWindowProps } from "@/types";
 
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
            <div className="header-title">{selectedConversation ? selectedConversation.name : "Mensajes"}</div>
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
              {selectedConversation.messages.map((message) => (
                <div key={message.id} className={message.author === "me" ? "chat-message is-me" : "chat-message is-friend"}>
                  <p>{message.text}</p>
                  <span>{message.time}</span>
                </div>
              ))}
              {selectedConversation.isTyping ? (
                <div className="chat-typing-bubble" aria-label={`${selectedConversation.name} está escribiendo`}>
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
