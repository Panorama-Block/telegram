import { motion, AnimatePresence } from "framer-motion";
import { Search, Paperclip, ArrowUp, Sparkles, User, Hexagon, ArrowRightLeft } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AgentsClient, type ChatResponse } from "@/clients/agentsClient";
import { useAuth } from "@/shared/contexts/AuthContext";
import { useActiveAccount } from "thirdweb/react";

const suggestions = [
  "Analyze my portfolio performance",
  "Bridge ETH to Optimism",
  "Find high yield staking pools",
  "Explain this smart contract"
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentName?: string | null;
  widget?: {
    type: 'balance' | 'swap_intent';
    data: any;
  };
}

interface ChatInterfaceProps {
  onSwapRequest?: (data: any) => void;
}

export function ChatInterface({ onSwapRequest }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const account = useActiveAccount();
  const { user } = useAuth();
  
  // Initialize AgentsClient
  const agentsClient = useMemo(() => new AgentsClient(), []);

  // Determine User ID
  const getWalletAddress = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const authPayload = localStorage.getItem('authPayload');
    if (authPayload) {
      try {
        const payload = JSON.parse(authPayload);
        return payload.address?.toLowerCase();
      } catch (error) {
        console.error('Error parsing authPayload:', error);
      }
    }
    return undefined;
  }, []);

  const userId = account?.address?.toLowerCase() || getWalletAddress() || (user?.id ? String(user.id) : undefined);
  
  const getAuthOptions = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const token = localStorage.getItem('authToken');
    return token ? { jwt: token } : undefined;
  }, []);

  // Bootstrap Conversation
  useEffect(() => {
    if (!userId) return;

    const bootstrapConversation = async () => {
      try {
        const authOpts = getAuthOptions();
        const conversationIds = await agentsClient.listConversations(userId, authOpts);
        
        let conversationId = conversationIds[0];
        
        if (!conversationId) {
          conversationId = await agentsClient.createConversation(userId, authOpts);
        }
        
        setActiveConversationId(conversationId);
        
        // Load history
        if (conversationId) {
            const history = await agentsClient.fetchMessages(userId, conversationId, authOpts);
            const mappedHistory: Message[] = history.map((msg, index) => {
                const isAssistant = msg.role === 'assistant';
                let widget = undefined;

                if (!isAssistant && msg.content?.toLowerCase()?.trim() === 'hi') {
                  return null;
                }

                // Basic widget mapping from metadata
                if (msg.metadata?.event === 'swap_intent_ready') {
                    widget = {
                        type: 'swap_intent' as const,
                        data: msg.metadata
                    };
                }

                return {
                    id: `history-${index}`,
                    role: isAssistant ? 'assistant' : 'user',
                    content: msg.content || '',
                    timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                    agentName: msg.agent_name,
                    widget
                };
            }).filter((msg): msg is Message => msg !== null);
            setMessages(mappedHistory);
        }

      } catch (error) {
        console.error("Failed to bootstrap conversation:", error);
      }
    };

    bootstrapConversation();
  }, [userId, agentsClient, getAuthOptions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending || !activeConversationId || !userId) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsSending(true);

    try {
        const GPT_STYLE_DIRECTIVE = [
            'You are Zico, a helpful DeFi assistant.',
            'Be concise and practical. No intro sentence.',
            'Use short paragraphs and simple bullet lists if helpful.',
            'Reply in the user\'s language.',
        ].join('\n');

        const finalUserContent = `${GPT_STYLE_DIRECTIVE}\n\nUser Message:\n${userMsg.content}`;

        const response = await agentsClient.chat({
            message: { role: 'user', content: finalUserContent },
            user_id: userId,
            conversation_id: activeConversationId,
            metadata: {
                source: 'miniapp-chat-v2',
                sent_at: new Date().toISOString(),
            },
        }, getAuthOptions());

        let widget = undefined;
        if (response.metadata?.event === 'swap_intent_ready') {
            widget = {
                type: 'swap_intent' as const,
                data: response.metadata
            };
        }

        const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: response.message || "I'm having trouble connecting right now.",
            timestamp: new Date(),
            agentName: response.agent_name,
            widget
        };
        
        setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
        console.error("Chat error:", error);
        const errorMsg: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: "Sorry, I encountered an error. Please try again.",
            timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
        setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[100dvh] relative overflow-hidden bg-black pb-safe">
      {/* Ambient God Ray - Stronger & More Atmospheric */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/20 via-slate-900/5 to-black blur-3xl pointer-events-none z-0" />

      <div className="flex-1 overflow-y-auto z-10 scrollbar-hide flex flex-col">
        {messages.length === 0 ? (
          // EMPTY STATE (HOME)
          <div className="flex-1 flex flex-col justify-start items-center w-full pb-safe pb-6 md:pb-4 pt-20 md:pt-[15vh] px-4 overflow-y-auto">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-3xl text-center flex flex-col items-center"
            >
              {/* 1. Title & Subtitle */}
              <div className="space-y-2 md:space-y-4 relative mb-8">
                <h1 className="text-4xl md:text-6xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 pb-2 leading-tight tracking-tight">
                  Hello, {user?.first_name || 'Alex'}.
                </h1>
                <p className="text-xl text-zinc-400 font-light">
                  Zico is ready to navigate the chain.
                </p>
              </div>

              {/* 2. Main Input Area (Barra de Chat) */}
              <div className="relative group max-w-2xl mx-auto w-full my-8">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-purple-500/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 md:p-2 flex items-center gap-2 md:gap-4 shadow-2xl group-focus-within:ring-1 group-focus-within:ring-cyan-500/30 group-focus-within:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all duration-300">
                  <div className="pl-2 md:pl-4 text-zinc-400">
                    <Search className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Zico anything..." 
                    className="flex-1 bg-transparent border-none outline-none text-base md:text-lg text-white placeholder:text-zinc-600 placeholder:text-sm md:placeholder:text-lg h-12 md:h-14"
                  />
                  <div className="flex items-center gap-2 pr-1 md:pr-2">
                    <button className="hidden md:block p-3 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={handleSendMessage}
                      disabled={isSending || !inputValue.trim()}
                      className="p-2 md:p-3 bg-primary text-black rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Suggestions Grid (Abaixo do Input) */}
              <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4 w-full md:w-auto mt-6">
                {suggestions.map((text, i) => (
                  <motion.button
                    key={i}
                    onClick={() => {
                      setInputValue(text);
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + (i * 0.1) }}
                    className="flex items-center gap-3 p-3 md:p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-cyan-400/50 transition-all duration-300 group text-left shadow-sm hover:shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                  >
                    <Sparkles className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors shrink-0" />
                    <span className="text-sm text-zinc-400 group-hover:text-zinc-200">{text}</span>
                  </motion.button>
                ))}
              </div>

            </motion.div>
          </div>
        ) : (
          // CHAT STATE
          <div className="max-w-3xl mx-auto w-full pt-32 pb-32 px-4 space-y-8">
            {messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex w-full",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'user' ? (
                  // USER MESSAGE
                  <div className="max-w-[80%] bg-zinc-800/80 backdrop-blur-sm text-white px-6 py-4 rounded-2xl rounded-tr-sm border border-white/5 shadow-lg">
                    <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : (
                  // AI MESSAGE
                  <div className="flex gap-4 max-w-[90%]">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_15px_rgba(34,211,238,0.3)] overflow-hidden p-1">
                      <img src="/logo.png" alt="Zico" className="w-full h-full object-contain drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
                    </div>
                    <div className="space-y-4">
                      <div className="text-zinc-100 text-base leading-relaxed whitespace-pre-wrap">
                         {msg.content}
                      </div>
                      
                      {/* WIDGET INJECTION (Example: Swap Intent) */}
                      {msg.widget && msg.widget.type === 'swap_intent' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 w-72 hover:border-cyan-400/30 transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">Swap Intent</span>
                            </div>
                            <span className="text-xs text-zinc-500">{msg.widget.data?.from_network}</span>
                          </div>
                          <div className="space-y-1 mb-4">
                            <div className="text-xl font-display font-bold text-white">
                              {msg.widget.data?.amount} <span className="text-sm font-sans font-normal text-zinc-500">{msg.widget.data?.from_token}</span>
                            </div>
                            <div className="flex items-center justify-center my-2 text-zinc-500">
                                <ArrowRightLeft className="w-4 h-4 rotate-90" />
                            </div>
                            <div className="text-xl font-display font-bold text-white">
                                <span className="text-sm font-sans font-normal text-zinc-500">To</span> {msg.widget.data?.to_token}
                            </div>
                          </div>
                          <button 
                            onClick={() => onSwapRequest?.(msg.widget?.data)}
                            className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            Open Swap Widget
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            
            {isSending && (
              <div className="flex gap-4 max-w-[90%]">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1 animate-pulse overflow-hidden p-1">
                  <img src="/logo.png" alt="Zico" className="w-full h-full object-contain drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
                </div>
                <div className="flex items-center gap-1 pt-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Sticky Bottom Input (Only visible in Chat State) */}
      <AnimatePresence>
        {messages.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="p-4 bg-gradient-to-t from-black via-black/90 to-transparent z-20"
          >
            <div className="max-w-3xl mx-auto relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-purple-500/30 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
              <div className="relative bg-[#0A0A0A] border border-white/10 rounded-2xl p-2 flex items-center gap-4 shadow-2xl group-focus-within:ring-1 group-focus-within:ring-cyan-500/30">
                <div className="pl-4 text-zinc-400">
                   <Sparkles className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send a message..." 
                  className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder:text-zinc-600 h-12"
                  autoFocus
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={isSending || !inputValue.trim()}
                  className="p-2.5 bg-primary text-black rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
              <div className="text-center mt-2">
                 <p className="text-[10px] text-zinc-600 uppercase tracking-widest">AI-Native Web3 Interface</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
