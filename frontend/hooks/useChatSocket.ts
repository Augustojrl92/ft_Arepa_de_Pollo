import { useEffect, useRef, useCallback, useState } from "react";
import { ChatUser, ChatConversation, ChatMessage, ChatNotification } from "@/types";
import { formatMessageTime } from "@/lib/chatFormat";

type SetFriends = React.Dispatch<React.SetStateAction<ChatUser[]>>;
type SetConversations = React.Dispatch<React.SetStateAction<ChatConversation[]>>;

type ChatMessageNotification = {
  fromUserId: number;
  fromUsername: string;
  message: string;
  timestamp: string;
};

type UseChatSocketOptions = {
  onMessageReceived?: (notification: ChatMessageNotification) => void;
};

type FriendListEntry = {
  user_id: number;
  display_name: string;
  login: string;
  active: boolean;
};

type ChatSocketPayload = {
  type?: string;
  friends?: { friends?: FriendListEntry[] };
  from_user_id?: number;
  from_username?: string;
  message?: string;
  timestamp?: string;
  user_id?: number;
  status?: string;
};

type ChatSocketOutgoingPayload = {
  type: string;
  to_user_id?: number;
  to_user_login?: string;
  message?: string;
  timestamp?: string;
};

const TYPING_TIMEOUT_MS = 3000;

export function useChatNotifications() {
	const [notifications, setNotifications] = useState<ChatNotification[]>([]);
 
	const addNotification = useCallback((notification: Omit<ChatNotification, 'id'>) => {
		const id = `${notification.from_login}-${Date.now()}`;
		setNotifications((prev) => [
			{ ...notification, id },
			...prev,
		]);
	}, []);
 
	const removeNotification = useCallback((id: string) => {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
	}, []);
 
	const clearAll = useCallback(() => {
		setNotifications([]);
	}, []);
 
	return {
		notifications,
		addNotification,
		removeNotification,
		clearAll,
	};
}

export default function useChatSocket(
  myLogin: string | undefined,
  setFriends: SetFriends,
  setConversations: SetConversations,
  options: UseChatSocketOptions = {}
) {
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageReceivedRef = useRef(options.onMessageReceived);
  const typingTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    onMessageReceivedRef.current = options.onMessageReceived;
  }, [options.onMessageReceived]);

  useEffect(() => {
    if (!myLogin) return;

    let isCleaningUp = false;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const chatSocket = new WebSocket(`${protocol}//${window.location.host}/ws/chat/`);
    socketRef.current = chatSocket;

    chatSocket.onopen = () => {
      if (isCleaningUp) {
        chatSocket.close();
      }
    };

    chatSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ChatSocketPayload;

        if (data.type === "friends_list") {
          const friendsList = data.friends?.friends ?? [];
          const mappedFriends: ChatUser[] = friendsList.map((friend) => ({
            id: friend.user_id,
            name: friend.display_name,
            login: friend.login,
            status: friend.active ? "En línea" : "Desconectado",
          }));
          setFriends(mappedFriends);
        }

        if (data.type === "typing") {
          const fromUserId = data.from_user_id;
          if (!fromUserId) return;
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
          const fromUserId = data.from_user_id;
          const fromUsername = data.from_username;
          const message = data.message;
          const timestamp = data.timestamp;
          if (!fromUserId || !fromUsername || !message || !timestamp) return;

          if (typingTimeoutsRef.current[fromUserId]) {
            clearTimeout(typingTimeoutsRef.current[fromUserId]);
            delete typingTimeoutsRef.current[fromUserId];
          }

          onMessageReceivedRef.current?.({
            fromUserId,
            fromUsername,
            message,
            timestamp,
          });

          window.dispatchEvent(new CustomEvent("chat:message", {
            detail: {
              fromUserId,
              fromUsername,
              message,
              timestamp,
            },
          }));
          setConversations((prev) => {
            const exists = prev.some((conv) => conv.id === fromUserId);            
            const newMessage: ChatMessage = {
              id: Date.now(),
              author: "friend",
              text: message,
              date: timestamp,
              time: formatMessageTime(timestamp),
            };

            if (exists) {
              return prev.map((conv) =>
                conv.id === fromUserId
                  ? {
                      ...conv,
                      isTyping: false,
                      messages: [...conv.messages, newMessage],
                      lastMessage: message,                      
                      lastTime: newMessage.time,
                    }
                  : conv
              );
            }

            return [
              {
                id: fromUserId,
                name: fromUsername,
                login: fromUsername,
                status: "En línea",
                lastMessage: message,
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
          if (!data.user_id) return;
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
      if (chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.close();
      }
    };
  }, [myLogin, setFriends, setConversations]);

  const sendMessage = (payload: ChatSocketOutgoingPayload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      console.error("WebSocket no está conectado");
    }
  };

  return { socketRef, sendMessage } as const;
}