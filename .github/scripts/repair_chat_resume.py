from pathlib import Path

chat_path = Path('apps/miniapp/src/app/chat/page.tsx')
chat = chat_path.read_text()

anchor = "  const searchParams = useSearchParams();\n"
insert = (
    "  const searchParams = useSearchParams();\n"
    "  const requestedConversationId = searchParams.get('conversation_id');\n"
    "  const requestedNewChat = searchParams.get('new') === 'true';\n"
)
if "const requestedConversationId = searchParams.get('conversation_id');" not in chat:
    if anchor not in chat:
        raise SystemExit('chat searchParams anchor not found')
    chat = chat.replace(anchor, insert, 1)

old_bootstrap = """        // Enter pending-new-chat mode: show welcome screen, create backend
        // conversation only when the user actually sends a message.
        setPendingNewChat(true);
        debug('bootstrap:pendingNewChat', { totalConversations: fetchedConversations.length });
        try {
          // Store only IDs to maintain compatibility with loadCachedConversationIds
          const idsToCache = fetchedConversations.map(c => c.id);
          localStorage.setItem(`${CONVERSATION_LIST_KEY}:${userKey}`, JSON.stringify(idsToCache));
        } catch (e) {
          console.warn('[CHAT CACHE] Failed to store conversation list', e);
        }



        // Use the selected/remembered conversation as the active one
        setActiveConversation(targetConversationId);
        setInitializationError(null);
        debug('bootstrap:targetSelected', { targetId: targetConversationId, totalConversations: fetchedConversations.length });
"""
new_bootstrap = """        // The URL is authoritative when an existing conversation is requested.
        // A fresh chat remains lazy-created on the first user message.
        if (requestedConversationId) {
          const requestedConversation = enriched.find(
            (conversation) => conversation.id === requestedConversationId
          );

          if (requestedConversation) {
            targetConversationId = requestedConversation.id;
            setPendingNewChat(false);
            debug('bootstrap:resumeConversation', { conversationId: requestedConversation.id });
          } else {
            setPendingNewChat(true);
            debug('bootstrap:requestedConversationNotFound', { conversationId: requestedConversationId });
          }
        } else {
          // /chat and /chat?new=true both show the fresh-chat welcome state.
          // The backend conversation is still created only on first send.
          setPendingNewChat(true);
          debug('bootstrap:pendingNewChat', {
            requestedNewChat,
            totalConversations: fetchedConversations.length,
          });
        }

        try {
          // Store only IDs to maintain compatibility with loadCachedConversationIds
          const idsToCache = fetchedConversations.map(c => c.id);
          localStorage.setItem(`${CONVERSATION_LIST_KEY}:${userKey}`, JSON.stringify(idsToCache));
        } catch (e) {
          console.warn('[CHAT CACHE] Failed to store conversation list', e);
        }

        setActiveConversation(targetConversationId);
        setInitializationError(null);
        debug('bootstrap:targetSelected', { targetId: targetConversationId, totalConversations: fetchedConversations.length });
"""
if old_bootstrap in chat:
    chat = chat.replace(old_bootstrap, new_bootstrap, 1)
elif "bootstrap:resumeConversation" not in chat:
    raise SystemExit('chat bootstrap block not found')

old_deps = "  }, [agentsClient, authLoading, bootstrapVersion, debug, getAuthOptions, loadCachedConversationIds, loadMessagesFromCache, setActiveConversation, setSidebarActiveConversationId, userId]);\n"
new_deps = "  }, [agentsClient, authLoading, bootstrapVersion, debug, getAuthOptions, loadCachedConversationIds, loadMessagesFromCache, requestedConversationId, requestedNewChat, setActiveConversation, setSidebarActiveConversationId, userId]);\n"
if old_deps in chat:
    chat = chat.replace(old_deps, new_deps, 1)
elif 'requestedConversationId, requestedNewChat' not in chat:
    raise SystemExit('chat bootstrap dependency block not found')

chat_path.write_text(chat)

home_path = Path('apps/miniapp/src/app/home/page.tsx')
home = home_path.read_text()

title_helper_anchor = "function formatTimeAgo(dateString: string): string {\n"
title_helper = """function isGenericConversationTitle(title?: string): boolean {
  if (!title) return true;
  const normalized = title.trim().toLowerCase();
  return !normalized || normalized === 'chat' || normalized === 'new chat' || /^chat\\s+\\d+$/.test(normalized);
}

function resolveConversationTitle(conversation: Conversation): string {
  if (!isGenericConversationTitle(conversation.title)) return conversation.title;
  if (typeof window === 'undefined') return conversation.title || `Conversation ${conversation.id.slice(0, 8)}`;

  try {
    const aiTitle = localStorage.getItem(`chat:aiTitle:${conversation.id}`);
    if (aiTitle?.trim()) return aiTitle;

    const exactKey = Object.keys(localStorage).find(
      (key) => key.startsWith('chat:cache:') && key.endsWith(`:${conversation.id}`)
    );
    if (exactKey) {
      const raw = localStorage.getItem(exactKey);
      const parsed = raw ? JSON.parse(raw) as Array<{ role?: string; content?: string }> : [];
      const firstUserMessage = parsed.find(
        (message) => message.role === 'user' && typeof message.content === 'string' && message.content.trim()
      );
      if (firstUserMessage?.content) {
        const normalized = firstUserMessage.content.trim().replace(/\\s+/g, ' ');
        const words = normalized.split(' ');
        const title = words.slice(0, 8).join(' ');
        return words.length > 8 ? `${title}...` : title;
      }
    }
  } catch {}

  return conversation.title || `Conversation ${conversation.id.slice(0, 8)}`;
}

function formatTimeAgo(dateString: string): string {
"""
if 'function resolveConversationTitle(conversation: Conversation)' not in home:
    if title_helper_anchor not in home:
        raise SystemExit('home title helper anchor not found')
    home = home.replace(title_helper_anchor, title_helper, 1)

old_render = "                          {conversation.title || `Conversation ${conversation.id.slice(0, 8)}`}\n"
new_render = "                          {resolveConversationTitle(conversation)}\n"
if old_render in home:
    home = home.replace(old_render, new_render, 1)
elif '{resolveConversationTitle(conversation)}' not in home:
    raise SystemExit('home title render not found')

home_path.write_text(home)
