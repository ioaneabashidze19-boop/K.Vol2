"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import {
  Send,
  Paperclip,
  Smile,
  Search,
  Archive,
  Phone,
  Pin,
  CheckCircle,
  ExternalLink,
  MessageSquare,
  ArrowLeft
} from "lucide-react";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface SeekerProfile {
  id: string;
  user_id: string;
  user: UserProfile;
}

interface CompanyProfile {
  id: string;
  name: string;
  logo_url?: string;
}

interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  seeker: SeekerProfile;
  company: CompanyProfile;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    name: string;
    role: string;
  };
}

export default function MessagesPage({ params }: PageProps) {
  const { locale } = use(params);
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const isKa = locale === "ka";

  // State variables
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  const [dbUserRole, setDbUserRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");

  // Local storage lists for demo-state (pins, archives)
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [pinnedMsgIds, setPinnedMsgIds] = useState<string[]>([]);

  // UI States
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string } | null>(null);
  const [isMobileListOpen, setIsMobileListOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiList = ["👍", "❤️", "😂", "🎉", "🙌", "🚀", "💡", "❓", "🔥", "👀"];

  // 1. Load preferences/archives from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedArchives = localStorage.getItem("kav_archived_conversations");
      if (storedArchives) {
        setArchivedIds(JSON.parse(storedArchives));
      }
      const storedPins = localStorage.getItem("kav_pinned_messages");
      if (storedPins) {
        setPinnedMsgIds(JSON.parse(storedPins));
      }
    }
  }, []);

  // 2. Fetch/resolve dbUser and conversations
  useEffect(() => {
    if (!isClerkLoaded || !clerkUser) return;
    const currentClerkId = clerkUser.id;

    async function initUserAndConversations() {
      try {
        setLoadingConv(true);
        // A. Resolve dbUser profile
        const { data: dbUser, error: userErr } = await supabase
          .from("users")
          .select("id, user_role")
          .eq("clerk_id", currentClerkId)
          .single();

        if (userErr || !dbUser) {
          console.error("Could not fetch dbUser profile:", userErr);
          return;
        }

        setDbUserId(dbUser.id);
        setDbUserRole(dbUser.user_role);

        // B. Fetch conversations list
        const res = await fetch("/api/conversations");
        const json = await res.json();
        if (json.success) {
          setConversations(json.conversations || []);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoadingConv(false);
      }
    }

    initUserAndConversations();
  }, [clerkUser, isClerkLoaded]);

  // 3. Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      return;
    }
    const convId = selectedConv.id;

    async function fetchMessages() {
      try {
        setLoadingMsg(true);
        const res = await fetch(`/api/conversations/${convId}`);
        const json = await res.json();
        if (json.success) {
          setMessages(json.messages || []);
          // Trigger POST request to mark messages as read
          await fetch("/api/messages/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: convId })
          });
        }
      } catch (err) {
        console.error("Error loading messages:", err);
      } finally {
        setLoadingMsg(false);
        scrollToBottom();
      }
    }

    fetchMessages();
    setIsMobileListOpen(false); // On mobile, close list sidebar upon selecting chat
  }, [selectedConv]);

  // 4. Supabase Real-time Message Subscription
  useEffect(() => {
    if (!selectedConv) return;
    const convId = selectedConv.id;

    const channel = supabase
      .channel(`messages_room_${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${convId}`
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;

          // Fetch sender info from profiles or users table
          const { data: senderProfile } = await supabase
            .from("users")
            .select("first_name, last_name, user_role")
            .eq("id", newMsg.sender_id)
            .single();

          const name = senderProfile
            ? `${senderProfile.first_name || ""} ${senderProfile.last_name || ""}`.trim()
            : "User";
          const formattedMsg: ChatMessage = {
            ...newMsg,
            sender: {
              name: name || "User",
              role: senderProfile?.user_role || "seeker"
            }
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === formattedMsg.id)) return prev;
            return [...prev, formattedMsg];
          });

          // Mark message as read if it is not sent by current user
          if (newMsg.sender_id !== dbUserId) {
            await fetch("/api/messages/read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversationId: convId })
            });
          }

          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv, dbUserId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  // 5. Send message action
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConv || (!inputValue.trim() && !attachedFile)) return;

    const textToSend = attachedFile
      ? `${inputValue.trim()} [Attachment: ${attachedFile.name} (${attachedFile.size})]`.trim()
      : inputValue.trim();

    setInputValue("");
    setAttachedFile(null);
    setShowEmojiPicker(false);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          content: textToSend
        })
      });

      const json = await res.json();
      if (json.success) {
        // Appended by subscription trigger or manually as fallback
        setMessages((prev) => {
          if (prev.some((m) => m.id === json.message.id)) return prev;
          return [...prev, json.message];
        });
        scrollToBottom();
      }
    } catch (err) {
      console.error("Send message failure:", err);
    }
  };

  // Keyboard shortcut trigger
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper resolvers for displaying conversation participants
  const getParticipantName = (conv: Conversation) => {
    if (dbUserRole === "seeker") {
      return conv.company?.name || (isKa ? "პროვაიდერი" : "Provider");
    }
    const seekerName = conv.seeker?.user
      ? `${conv.seeker.user.name || ""}`.trim()
      : (isKa ? "კლიენტი" : "Client");
    return seekerName || (isKa ? "კლიენტი" : "Client");
  };

  const getParticipantAvatar = (conv: Conversation) => {
    if (dbUserRole === "seeker") {
      return conv.company?.logo_url || "";
    }
    return "";
  };

  const getUnreadCount = (_convId: string) => {
    // Demo-state count (for UI rendering we mock or calculate based on local count)
    return 0;
  };

  // Toggle Pinned status
  const togglePinMessage = (msgId: string) => {
    let nextPins = [...pinnedMsgIds];
    if (nextPins.includes(msgId)) {
      nextPins = nextPins.filter((id) => id !== msgId);
    } else {
      nextPins.push(msgId);
    }
    setPinnedMsgIds(nextPins);
    localStorage.setItem("kav_pinned_messages", JSON.stringify(nextPins));
  };

  // Toggle Archive conversation status
  const toggleArchiveConversation = (convId: string) => {
    let nextArchives = [...archivedIds];
    if (nextArchives.includes(convId)) {
      nextArchives = nextArchives.filter((id) => id !== convId);
    } else {
      nextArchives.push(convId);
    }
    setArchivedIds(nextArchives);
    localStorage.setItem("kav_archived_conversations", JSON.stringify(nextArchives));
    setSelectedConv(null);
  };

  // Search & filter conversations
  const filteredConversations = conversations.filter((conv) => {
    const name = getParticipantName(conv).toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query);

    const isArchived = archivedIds.includes(conv.id);
    const matchesStatus = statusFilter === "archived" ? isArchived : !isArchived;

    return matchesSearch && matchesStatus;
  });

  // Group messages by calendar date helper
  const groupMessagesByDate = (msgs: ChatMessage[]) => {
    const groups: { [key: string]: ChatMessage[] } = {};
    msgs.forEach((msg) => {
      const date = new Date(msg.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-slate-950 text-text-primary rounded-2xl border border-slate-900 shadow-2xl relative">
      {/* 1. Left Side: Sidebar conversation list */}
      <div
        className={`w-full md:w-80 border-r border-slate-900 bg-slate-950 flex flex-col transition-all duration-300 ${
          isMobileListOpen ? "block absolute inset-0 z-40 md:relative" : "hidden md:flex"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-900 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-bold tracking-tight">
              {isKa ? "შეტყობინებები" : "Direct Messages"}
            </h2>
            <div className="flex bg-slate-900 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-2.5 py-1 rounded-md transition ${
                  statusFilter === "active" ? "bg-slate-800 text-text-primary" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {isKa ? "აქტიური" : "Active"}
              </button>
              <button
                onClick={() => setStatusFilter("archived")}
                className={`px-2.5 py-1 rounded-md transition ${
                  statusFilter === "archived" ? "bg-slate-800 text-text-primary" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {isKa ? "არქივი" : "Archived"}
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
            <input
              type="text"
              placeholder={isKa ? "ძებნა..." : "Search threads..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800/80 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-emerald-500 text-text-primary placeholder-text-muted"
            />
          </div>
        </div>

        {/* Conversations Scrollbar */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-900/50 p-2 space-y-1">
          {loadingConv ? (
            <div className="text-center text-xs text-text-muted py-8">
              {isKa ? "იტვირთება..." : "Loading conversation threads..."}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center text-xs text-text-muted py-12">
              <MessageSquare className="h-8 w-8 mx-auto opacity-20 mb-2" />
              {isKa ? "საუბრები არ მოიძებნა" : "No active threads found."}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const active = selectedConv?.id === conv.id;
              const name = getParticipantName(conv);
              const avatar = getParticipantAvatar(conv);
              const unread = getUnreadCount(conv.id);

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 transition text-left group ${
                    active ? "bg-slate-900" : "hover:bg-slate-900/40"
                  }`}
                >
                  <div className="h-9 w-9 rounded-full bg-slate-800 flex-shrink-0 flex items-center justify-center font-bold text-xs uppercase text-emerald-400 border border-slate-700/50 overflow-hidden">
                    {avatar ? (
                      <img src={avatar} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      name.slice(0, 2)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className={`text-xs font-bold truncate ${active ? "text-emerald-400" : "text-text-primary"}`}>
                        {name}
                      </span>
                      <span className="text-[9px] text-text-muted whitespace-nowrap">
                        {new Date(conv.updated_at).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-muted truncate mt-0.5">
                      {isKa ? "დააწკაპუნეთ საუბრის გასახსნელად" : "Click to view message thread"}
                    </div>
                  </div>
                  {unread > 0 && (
                    <span className="h-4 min-w-4 px-1 rounded-full bg-emerald-500 text-slate-950 font-bold text-[8px] flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Right Side: Chat Panel */}
      <div className="flex-1 flex flex-col bg-slate-950/80">
        {selectedConv ? (
          <>
            {/* Active Conversation Header */}
            <div className="p-4 border-b border-slate-900 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setIsMobileListOpen(true)}
                  className="md:hidden p-1.5 hover:bg-slate-900 rounded-lg text-text-secondary"
                  aria-label="Back to messages list"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs uppercase text-emerald-400 border border-slate-700/50 overflow-hidden">
                  {getParticipantAvatar(selectedConv) ? (
                    <img
                      src={getParticipantAvatar(selectedConv)}
                      alt={getParticipantName(selectedConv)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getParticipantName(selectedConv).slice(0, 2)
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-text-primary truncate">
                      {getParticipantName(selectedConv)}
                    </h3>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-text-muted">
                    <span>{dbUserRole === "seeker" ? (isKa ? "პროვაიდერი" : "Provider Profile") : (isKa ? "კლიენტი" : "Seeker Account")}</span>
                    {dbUserRole === "seeker" && (
                      <a
                        href={`/marketplace/providers/${selectedConv.company.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    alert(isKa ? "ეს ფუნქცია მალე დაემატება!" : "Voice calling feature coming soon!");
                  }}
                  className="p-2 hover:bg-slate-900 rounded-lg text-text-muted hover:text-text-primary transition"
                  title={isKa ? "ხმოვანი ზარი" : "Voice call"}
                >
                  <Phone className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleArchiveConversation(selectedConv.id)}
                  className="p-2 hover:bg-slate-900 rounded-lg text-text-muted hover:text-text-primary transition"
                  title={archivedIds.includes(selectedConv.id) ? (isKa ? "აქტიურში გადატანა" : "Unarchive") : (isKa ? "დაარქივება" : "Archive")}
                >
                  <Archive className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Pinned Messages Shelf (if there are pinned messages in this conversation) */}
            {messages.filter((m) => pinnedMsgIds.includes(m.id)).length > 0 && (
              <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-900/80 flex items-center justify-between text-[10px] text-emerald-400">
                <div className="flex items-center gap-2 truncate">
                  <Pin className="h-3 w-3 flex-shrink-0 rotate-45" />
                  <span className="font-bold truncate">
                    Pinned: {messages.filter((m) => pinnedMsgIds.includes(m.id)).map((m) => m.content).join(" | ")}
                  </span>
                </div>
                <button
                  onClick={() => setPinnedMsgIds([])}
                  className="text-text-muted hover:text-text-primary font-semibold shrink-0"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Message History Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {loadingMsg ? (
                <div className="text-center text-xs text-text-muted py-12">
                  {isKa ? "იტვირთება შეტყობინებები..." : "Retrieving history..."}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-text-muted py-16">
                  {isKa ? "დაიწყეთ მიმოწერა!" : "No messages yet. Send a greeting message below!"}
                </div>
              ) : (
                Object.keys(groupedMessages).map((date) => (
                  <div key={date} className="space-y-4">
                    {/* Date bubble */}
                    <div className="flex justify-center">
                      <span className="bg-slate-900/80 border border-slate-850 px-2.5 py-1 rounded-full text-[9px] font-bold text-text-muted uppercase tracking-wider">
                        {date}
                      </span>
                    </div>

                    {/* Messages under this date */}
                    {groupedMessages[date].map((msg) => {
                      const isMe = msg.sender_id === dbUserId;
                      const isPinned = pinnedMsgIds.includes(msg.id);

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-2.5 max-w-[85%] md:max-w-[70%] group ${
                            isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                          }`}
                        >
                          {/* Sender name initial avatar */}
                          {!isMe && (
                            <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700/50 flex-shrink-0 flex items-center justify-center font-bold text-[10px] uppercase text-emerald-400">
                              {msg.sender?.name.slice(0, 2) || "U"}
                            </div>
                          )}

                          <div className="space-y-1">
                            {/* Sender title */}
                            {!isMe && (
                              <div className="text-[9px] text-text-muted font-semibold px-1">
                                {msg.sender?.name}
                              </div>
                            )}

                            {/* Message bubble */}
                            <div
                              className={`relative p-3 rounded-2xl text-xs leading-normal select-text transition shadow-md border ${
                                isMe
                                  ? "bg-emerald-500 text-slate-950 font-medium rounded-tr-none border-emerald-400"
                                  : "bg-slate-900 text-text-primary rounded-tl-none border-slate-850"
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.content}</p>

                              {/* Message actions popup on hover */}
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-slate-950 border border-slate-850 px-1.5 py-1 rounded-lg shadow-lg z-10 ${
                                  isMe ? "right-full mr-2" : "left-full ml-2"
                                }`}
                              >
                                <button
                                  onClick={() => togglePinMessage(msg.id)}
                                  className={`p-1 hover:bg-slate-900 rounded ${
                                    isPinned ? "text-emerald-400" : "text-text-muted"
                                  }`}
                                  title="Pin message"
                                >
                                  <Pin className="h-3 w-3 rotate-45" />
                                </button>
                              </div>
                            </div>

                            {/* Time & Read receipts */}
                            <div className={`flex items-center gap-1.5 text-[9px] text-text-muted px-1 mt-0.5 ${isMe ? "justify-end" : ""}`}>
                              <span>
                                {new Date(msg.created_at).toLocaleTimeString(undefined, {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                              {isMe && (
                                <CheckCircle className={`h-3 w-3 ${msg.is_read ? "text-emerald-400" : "text-text-muted"}`} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Compose Box */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-900 bg-slate-950 relative">
              {/* Attachment chip indicator */}
              {attachedFile && (
                <div className="absolute bottom-full left-4 mb-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] text-emerald-400 animate-fade-in shadow-xl">
                  <Paperclip className="h-3.5 w-3.5 animate-bounce" />
                  <span>
                    {attachedFile.name} ({attachedFile.size})
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="text-text-muted hover:text-rose-450 font-bold ml-1 text-xs"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Emoji quick selection shelf */}
              {showEmojiPicker && (
                <div className="absolute bottom-full left-4 mb-2 bg-slate-900 border border-slate-800 p-2 rounded-xl flex gap-1.5 shadow-2xl animate-fade-in z-30">
                  {emojiList.map((emo) => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => {
                        setInputValue((prev) => prev + emo);
                        setShowEmojiPicker(false);
                      }}
                      className="hover:scale-125 transition p-1 text-sm text-text-primary"
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              )}

              {/* Input layout */}
              <div className="flex items-end gap-2 bg-slate-900 border border-slate-800/80 rounded-xl p-2 focus-within:border-emerald-500/80 transition">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1.5 hover:bg-slate-850 rounded-lg text-text-muted hover:text-text-primary transition"
                  title="Insert emoji"
                >
                  <Smile className="h-4.5 w-4.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAttachedFile({
                      name: `invoice_slip_${Math.floor(1000 + Math.random() * 9000)}.pdf`,
                      size: "248 KB"
                    });
                  }}
                  className="p-1.5 hover:bg-slate-850 rounded-lg text-text-muted hover:text-text-primary transition"
                  title="Attach file"
                >
                  <Paperclip className="h-4.5 w-4.5" />
                </button>

                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isKa ? "დაწერეთ შეტყობინება..." : "Write a message... (Ctrl+Enter to send)"}
                  rows={1}
                  maxLength={1000}
                  className="flex-1 bg-transparent border-0 outline-none text-xs text-text-primary placeholder-text-muted max-h-24 resize-none py-1.5 px-1 font-sans"
                />

                <span className="text-[9px] text-text-muted self-center px-1 font-mono font-bold">
                  {inputValue.length}/1000
                </span>

                <button
                  type="submit"
                  disabled={!inputValue.trim() && !attachedFile}
                  className="bg-emerald-500 hover:bg-emerald-450 disabled:bg-slate-800 text-slate-950 disabled:text-text-muted p-2 rounded-lg transition"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted select-none">
            <MessageSquare className="h-12 w-12 text-slate-800 mb-3 animate-pulse" />
            <h3 className="text-sm font-bold text-text-primary">
              {isKa ? "პირადი შეტყობინებები" : "Your Inbox"}
            </h3>
            <p className="text-xs text-text-muted mt-1 max-w-sm leading-normal">
              {isKa
                ? "აირჩიეთ საუბარი მარცხენა სიიდან მიმოწერის დასაწყებად."
                : "Select a conversation thread from the sidebar list to view message history and participate in chats."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
