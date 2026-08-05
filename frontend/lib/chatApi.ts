import { authFetchJson } from './authApi'

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/\$/, "")
const CHAT_BASE_URL = API_URL ? `${API_URL}/api/chat` : "/api/chat"

export async function fetchMessagesWith(login: string) {
  const data = await authFetchJson<{
    messages: Array<{
      sender_login: string
      receiver_login: string
      message: string
      date_time: string
    }>
  }>(
    `${CHAT_BASE_URL}/messages/${login}/`,
    { method: 'GET' },
    'No se han podido obtener los mensajes',
  )
  return data.messages
}

export async function fetchConversations() {
  const data = await authFetchJson<{
    conversations: Array<{
      id: number
      login: string
      name: string
      last_message: string
      last_time: string
    }>
  }>(
    `${CHAT_BASE_URL}/conversations/`,
    { method: 'GET' },
    'No se han podido obtener las conversaciones',
  )
  return data.conversations
}