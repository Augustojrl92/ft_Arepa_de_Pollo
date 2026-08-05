import { useEffect, useState, useCallback } from "react";
import { fetchConversations } from "@/lib/chatApi";
import { formatMessageTime } from "@/lib/chatFormat";
import { ChatConversation } from "@/types";

export default function useConversations(myLogin?: string) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);

  const loadConversations = useCallback(() => {
    if (!myLogin) return;

    let isCancelled = false;

    fetchConversations()
      .then((rows) => {
        if (isCancelled) return;

        setConversations((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newOnes: ChatConversation[] = rows
            .filter((row) => !existingIds.has(row.id))
            .map((row) => ({
              id: row.id,
              name: row.name,
              login: row.login,
              status: "Desconectado",
              lastMessage: row.last_message,
              lastTime: formatMessageTime(row.last_time),
              messages: [],
              isTyping: false,
            }));
          return [...prev, ...newOnes];
        });
      })
      .catch((err) => console.error("Error cargando conversaciones:", err));
    return () => {
      isCancelled = true;
    };
  }, [myLogin]);
  useEffect(() => {
    const cleanup = loadConversations();
    return cleanup;
  }, [loadConversations]);

  return { conversations, setConversations, loadConversations } as const;
}
