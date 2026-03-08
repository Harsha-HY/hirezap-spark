import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Loader2 } from "lucide-react";

interface Props {
  offerId: string;
  currentUserId: string;
  currentUserRole: string;
  currentUserName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Message {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

const NegotiationChat = ({ offerId, currentUserId, currentUserRole, currentUserName, open, onOpenChange }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !offerId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("negotiation_messages")
        .select("*")
        .eq("offer_id", offerId)
        .order("created_at", { ascending: true });
      setMessages((data as any) || []);
    };
    fetchMessages();

    const channel = supabase
      .channel(`negotiation-${offerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "negotiation_messages", filter: `offer_id=eq.${offerId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, offerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      await supabase.from("negotiation_messages").insert({
        offer_id: offerId,
        sender_id: currentUserId,
        sender_role: currentUserRole,
        message: newMessage.trim(),
      } as any);
      setNewMessage("");
    } catch (e) {
      console.error(e);
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>💬 Salary Negotiation</DialogTitle>
        </DialogHeader>

        <div className="h-80 overflow-y-auto border border-border rounded-lg p-3 space-y-3 bg-muted/30">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Start the conversation.</p>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender_id === currentUserId ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                msg.sender_id === currentUserId
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground"
              }`}>
                <p className="text-[10px] font-medium opacity-70 mb-0.5">{msg.sender_role === "candidate" ? "Candidate" : "HR"}</p>
                <p>{msg.message}</p>
                <p className="text-[10px] opacity-60 mt-1">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={e => e.key === "Enter" && handleSend()}
          />
          <Button size="icon" onClick={handleSend} disabled={sending || !newMessage.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NegotiationChat;
