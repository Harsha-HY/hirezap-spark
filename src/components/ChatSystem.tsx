import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Search, MessageSquare, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  photo_url?: string;
  company_id?: string;
  department?: string;
}

interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerRole: string;
  partnerPhoto?: string;
  jobTitle?: string;
  currentStage?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  applicationId?: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  attachment_url?: string;
}

interface Props {
  currentUser: ChatUser;
  mode: "staff" | "candidate" | "admin";
  companyId?: string;
}

const ChatSystem = ({ currentUser, mode, companyId }: Props) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    // Get all messages involving current user
    const { data: allMessages } = await supabase
      .from("chat_messages")
      .select("*")
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order("created_at", { ascending: false });

    if (!allMessages) { setLoading(false); return; }

    // Group by conversation partner
    const convMap = new Map<string, { msgs: any[]; unread: number }>();
    for (const msg of allMessages as any[]) {
      const partnerId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
      if (!convMap.has(partnerId)) {
        convMap.set(partnerId, { msgs: [], unread: 0 });
      }
      const conv = convMap.get(partnerId)!;
      conv.msgs.push(msg);
      if (!msg.is_read && msg.receiver_id === currentUser.id) {
        conv.unread++;
      }
    }

    // Get partner info
    const partnerIds = Array.from(convMap.keys());
    if (partnerIds.length === 0) { setConversations([]); setLoading(false); return; }

    const { data: partners } = await supabase
      .from("users")
      .select("id, full_name, role, email, department")
      .in("id", partnerIds);

    // Get application/job info for candidates
    const candidatePartnerIds = (partners || []).filter(p => p.role === "candidate").map(p => p.id);
    let appMap: Record<string, { jobTitle: string; currentStage: string; photoUrl?: string }> = {};

    if (candidatePartnerIds.length > 0) {
      const { data: apps } = await supabase
        .from("applications")
        .select("candidate_id, current_stage, photo_url, jobs(title)")
        .in("candidate_id", candidatePartnerIds);

      if (apps) {
        for (const app of apps as any[]) {
          appMap[app.candidate_id] = {
            jobTitle: app.jobs?.title || "—",
            currentStage: app.current_stage,
            photoUrl: app.photo_url,
          };
        }
      }
    }

    const convList: Conversation[] = partnerIds.map(pid => {
      const partner = (partners || []).find(p => p.id === pid);
      const conv = convMap.get(pid)!;
      const lastMsg = conv.msgs[0];
      const appInfo = appMap[pid];

      return {
        partnerId: pid,
        partnerName: partner?.full_name || "Unknown",
        partnerRole: partner?.role || "unknown",
        partnerPhoto: appInfo?.photoUrl || undefined,
        jobTitle: appInfo?.jobTitle,
        currentStage: appInfo?.currentStage,
        lastMessage: lastMsg.message,
        lastMessageTime: lastMsg.created_at,
        unreadCount: conv.unread,
      };
    });

    convList.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    setConversations(convList);
    setLoading(false);
  }, [currentUser.id]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async () => {
    if (!selectedPartner) return;

    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedPartner}),and(sender_id.eq.${selectedPartner},receiver_id.eq.${currentUser.id})`
      )
      .order("created_at", { ascending: true });

    if (data) setMessages(data as any[]);

    // Mark as read
    await supabase
      .from("chat_messages")
      .update({ is_read: true } as any)
      .eq("sender_id", selectedPartner)
      .eq("receiver_id", currentUser.id)
      .eq("is_read", false);

    fetchConversations();
  }, [selectedPartner, currentUser.id, fetchConversations]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("chat-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        if (newMsg.sender_id === currentUser.id || newMsg.receiver_id === currentUser.id) {
          if (selectedPartner && (newMsg.sender_id === selectedPartner || newMsg.receiver_id === selectedPartner)) {
            setMessages(prev => [...prev, newMsg]);
            // Auto mark as read
            if (newMsg.receiver_id === currentUser.id) {
              supabase.from("chat_messages").update({ is_read: true } as any).eq("id", newMsg.id).then();
            }
          }
          fetchConversations();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser.id, selectedPartner, fetchConversations]);

  // Fetch available candidates for new chat (staff only)
  const fetchCandidates = async () => {
    if (!companyId) return;

    const { data: jobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("company_id", companyId);

    if (!jobs?.length) return;
    const jobIds = jobs.map(j => j.id);

    // For manager, filter by department
    let query = supabase
      .from("applications")
      .select("candidate_id, current_stage, photo_url, jobs(title)")
      .in("job_id", jobIds)
      .neq("status", "deleted");

    const { data: apps } = await query;
    if (!apps) return;

    const candidateIds = [...new Set((apps as any[]).map(a => a.candidate_id))];
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, email, department")
      .in("id", candidateIds);

    const enriched = (users || []).map(u => {
      const app = (apps as any[]).find(a => a.candidate_id === u.id);
      return {
        ...u,
        jobTitle: app?.jobs?.title || "—",
        currentStage: app?.current_stage || "—",
        photoUrl: app?.photo_url,
      };
    });

    setCandidates(enriched);
    setShowNewChat(true);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedPartner) return;
    setSending(true);

    const { error } = await supabase.from("chat_messages").insert({
      sender_id: currentUser.id,
      receiver_id: selectedPartner,
      message: newMessage.trim(),
    } as any);

    if (!error) {
      setNewMessage("");

      // Send notification for first message or important ones
      const partner = conversations.find(c => c.partnerId === selectedPartner);
      if (partner) {
        const roleLabel = currentUser.role === "hr" ? "HR" : currentUser.role === "manager" ? "Hiring Manager" : "Candidate";
        await supabase.from("notifications").insert({
          user_id: selectedPartner,
          title: `💬 Message from ${roleLabel}`,
          message: `${currentUser.full_name} sent: "${newMessage.trim().substring(0, 80)}..."`,
        } as any);
      }
    }

    setSending(false);
  };

  const startNewChat = (candidateId: string) => {
    setSelectedPartner(candidateId);
    setShowNewChat(false);
    // Add to conversations if not already there
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate && !conversations.find(c => c.partnerId === candidateId)) {
      setConversations(prev => [{
        partnerId: candidateId,
        partnerName: candidate.full_name,
        partnerRole: "candidate",
        jobTitle: candidate.jobTitle,
        currentStage: candidate.currentStage,
        lastMessage: "",
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
      }, ...prev]);
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConv = conversations.find(c => c.partnerId === selectedPartner);

  return (
    <div className="flex h-[calc(100vh-12rem)] rounded-xl border border-border bg-card overflow-hidden">
      {/* Left Panel - Conversations */}
      <div className="w-80 border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground">Messages</h3>
            {mode === "staff" && (
              <Button size="sm" onClick={fetchCandidates} className="h-7 text-xs bg-primary text-primary-foreground">
                + New Chat
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-secondary border-border"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-0.5 p-1">
              {filteredConversations.map(conv => (
                <button
                  key={conv.partnerId}
                  onClick={() => setSelectedPartner(conv.partnerId)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedPartner === conv.partnerId
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-secondary"
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    {conv.partnerPhoto ? (
                      <img src={conv.partnerPhoto} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground truncate">{conv.partnerName}</p>
                      {conv.unreadCount > 0 && (
                        <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.jobTitle && (
                      <p className="text-[11px] text-primary truncate">{conv.jobTitle}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage || "No messages yet"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(conv.lastMessageTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Chat Window */}
      <div className="flex-1 flex flex-col">
        {!selectedPartner ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">Select a conversation to start</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                {selectedConv?.partnerPhoto ? (
                  <img src={selectedConv.partnerPhoto} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{selectedConv?.partnerName}</p>
                <div className="flex items-center gap-2">
                  {selectedConv?.jobTitle && (
                    <span className="text-[11px] text-muted-foreground">{selectedConv.jobTitle}</span>
                  )}
                  {selectedConv?.currentStage && (
                    <Badge variant="secondary" className="text-[10px] h-5 capitalize">
                      {selectedConv.currentStage.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                <AnimatePresence>
                  {messages.map(msg => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.sender_id === currentUser.id ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                          msg.sender_id === currentUser.id
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-secondary text-foreground rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${
                          msg.sender_id === currentUser.id ? "text-primary-foreground/60" : "text-muted-foreground"
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input Area - hidden for admin mode */}
            {mode !== "admin" && (
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="bg-secondary border-border"
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={sending || !newMessage.trim()}
                    className="bg-primary text-primary-foreground shrink-0"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Start New Chat</h3>
              <button onClick={() => setShowNewChat(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <Input
              placeholder="Search candidates..."
              className="mb-3 bg-secondary border-border"
              onChange={e => {
                const q = e.target.value.toLowerCase();
                // Filter already handled inline
                setSearchQuery(q);
              }}
            />
            <ScrollArea className="h-64">
              <div className="space-y-1">
                {candidates
                  .filter(c => c.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(c => (
                    <button
                      key={c.id}
                      onClick={() => startNewChat(c.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary text-left transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        {c.photoUrl ? (
                          <img src={c.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <User className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                        <p className="text-[11px] text-primary">{c.jobTitle}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{c.currentStage?.replace(/_/g, " ")}</p>
                      </div>
                    </button>
                  ))}
                {candidates.length === 0 && (
                  <p className="text-center py-6 text-sm text-muted-foreground">No candidates found</p>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ChatSystem;
