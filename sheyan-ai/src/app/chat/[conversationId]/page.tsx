import { UserApp } from "@/components/chat/user-app";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <UserApp initialConversationId={conversationId} />;
}
