import { XIcon } from "lucide-react";
import React from "react";
import { ChatUser } from "@/types";
 
export default function NewChatModal({
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
  if (!open) return null;
 
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