"use client";
import { ReactNode } from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ConversationSidebar from "@/components/conversation-sidebar";

interface Chatlog {
  _id: string;
  title: string;
  person: string;
  firstInteraction: string;
  lastInteraction: string;
  messages: { role: string; content: string }[];
}

export default function HomeLayout({children}: {children: ReactNode}) {
  const [conversations, setConversations] = useState<Chatlog[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => {
        setConversations(data);
      })
      .catch((error) => {
        console.error("Error fetching conversations:", error);
      });
  }, []);

  return (
    <div className="h-screen flex-row flex overflow-auto bg-black">
      {/* Sidebar */}
      <div className="overflow-auto">
        <ConversationSidebar
          conversations={conversations}
          onConversationSelect={(id) => router.push(`/annotator/home/${id}`)}
        />
      </div>
      <div className = "flex-1 overflow-auto">{children}</div>
    </div>
  );
}
