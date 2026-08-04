import { useEffect, useRef } from "react";
import { ChatUser, ChatConversation, ChatMessage } from "@/types";

type SetFriends = React.Dispatch<React.SetStateAction<ChatUser[]>>;
type SetConversations = React.Dispatch<React.SetStateAction<ChatConversation[]>>;

const TYPING_TIMEOUT_MS = 3000;

export default function useChatSocket(
  myLogin: string | undefined,
  setFriends: SetFriends,
  setConversations: SetConversations
) {
  const socketRef = useRef<WebSocket | null>(null);
  // Un timeout por usuario: cada vez que llega "typing" se reinicia; si no
  // llega otro en TYPING_TIMEOUT_MS, se asume que dejó de escribir.
  const typingTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!myLogin) return;

    let isCleaningUp = false;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const chatSocket = new WebSocket(`${protocol}//${window.location.host}/ws/chat/`);
    socketRef.current = chatSocket;
    chatSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "friends_list") {
          const friendsList = data.friends?.friends ?? [];
          const mappedFriends: ChatUser[] = friendsList.map((friend: any) => ({
            id: friend.user_id,
            name: friend.display_name,
            login: friend.login,
            status: friend.active ? "En línea" : "Desconectado",
          }));
          setFriends(mappedFriends);
        }

        if (data.type === "typing") {
          const fromUserId = data.from_user_id;

          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === fromUserId ? { ...conv, isTyping: true } : conv
            )
          );

          if (typingTimeoutsRef.current[fromUserId]) {
            clearTimeout(typingTimeoutsRef.current[fromUserId]);
          }
          typingTimeoutsRef.current[fromUserId] = setTimeout(() => {
            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === fromUserId ? { ...conv, isTyping: false } : conv
              )
            );
            delete typingTimeoutsRef.current[fromUserId];
          }, TYPING_TIMEOUT_MS);
          return;
        }

        if (data.type === "message") {
          // Alguien que estaba "escribiendo" y ahora mandó el mensaje: apaga
          // el indicador de inmediato en vez de esperar el timeout.
          if (typingTimeoutsRef.current[data.from_user_id]) {
            clearTimeout(typingTimeoutsRef.current[data.from_user_id]);
            delete typingTimeoutsRef.current[data.from_user_id];
          }

          setConversations((prev) => {
            const exists = prev.some((conv) => conv.id === data.from_user_id);
            const newMessage: ChatMessage = {
              id: Date.now(),
              author: "friend",
              text: data.message,
              time: new Date(data.timestamp).toLocaleTimeString(),
            };

            if (exists) {
              return prev.map((conv) =>
                conv.id === data.from_user_id
                  ? {
                      ...conv,
                      isTyping: false,
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
                status: "En línea",
                lastMessage: data.message,
                lastTime: newMessage.time,
                messages: [newMessage],
                isTyping: false,
              },
              ...prev,
            ];
          });
          return;
        }

        if (data.type === "status_update") {
          setFriends((prev) =>
            prev.map((friend) =>
              friend.id === data.user_id
                ? { ...friend, status: data.status === "online" ? "En línea" : "Desconectado" }
                : friend
            )
          );
        }
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    chatSocket.onerror = (error) => {
      if (isCleaningUp) return;
      console.error("Error WebSocket:", error);
    };

    chatSocket.onclose = (event) => console.log("Desconectado del chat", event.code, event.reason);

    return () => {
      isCleaningUp = true;
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      if (
        chatSocket.readyState === WebSocket.OPEN ||
        chatSocket.readyState === WebSocket.CONNECTING
      ) {
        chatSocket.close();
      }
    };
  }, [myLogin, setFriends, setConversations]);

  const sendMessage = (payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      console.error("WebSocket no está conectado");
    }
  };

  return { socketRef, sendMessage } as const;
}