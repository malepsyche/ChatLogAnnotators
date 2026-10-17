"use client";

import { ReactNode, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import ConversationSidebar from "@/components/conversation-sidebar";
import { Conversation } from "@/types/conversations";
import { useAssignment } from "@/components/context/assignment-context";

export default function HomeLayout({ children }: { children: ReactNode }) {
  const [filteredConversations, setFilteredConversations] = useState<
    Conversation[]
  >([]);
  const [tempQuery, setTempQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const router = useRouter();
  const pathname = usePathname();
  const { activeAssignment } = useAssignment();

  const selectedConversation = pathname.match(
    /^\/annotator\/home\/([^/]+)/
  )?.[1] || null;

  useEffect(() => {
    if (!activeAssignment) {
      setFilteredConversations([]);
      return;
    }

    let cancelled = false;

    const fetchConversations = async () => {
      try {
        const queryParam = searchQuery
          ? `&query=${encodeURIComponent(searchQuery)}`
          : "";

        const response = await fetch(
          `/api/conversations/annotators?assignmentId=${encodeURIComponent(
            activeAssignment
          )}${queryParam}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch conversations");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Expected an array of conversations");
        }

        if (cancelled) return;

        const transformedData = data.map((chatlog) => ({
          _id: chatlog._id || "unknown_id",
          title: chatlog.title || "Untitled",
          stime: {
            text: chatlog.firstInteraction || "Unknown Start Time",
            timestamp: Date.parse(chatlog.firstInteraction) || 0,
          },
          last_interact: {
            text: chatlog.lastInteraction || "Unknown Last Interaction",
            timestamp: Date.parse(chatlog.lastInteraction) || 0,
          },
          person: chatlog.person || "Unknown Person",
          messages: chatlog.messages || [],
          annotations: chatlog.annotations || [],
          lock: chatlog.lock,
          effectiveLock: chatlog.effectiveLock,
        }));

        setFilteredConversations(transformedData);
      } catch (error) {
        if (cancelled) return;

        console.error("[HomeLayout] Error fetching conversations:", error);
        setFilteredConversations([]);
      }
    };

    void fetchConversations();

    return () => {
      cancelled = true;
    };
  }, [searchQuery, activeAssignment]);

  useEffect(() => {
    router.push("/annotator/home");
  }, [activeAssignment, router]);

  return (
    <div className="flex-row flex text-foreground bg-background">
      <div className="w-80 bg-background text-sidebar-foreground h-full border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border">
          <input
            type="text"
            placeholder="Search conversations..."
            value={tempQuery}
            onChange={(e) => setTempQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearchQuery(tempQuery)}
            className="w-full p-2 rounded-md bg-input text-foreground border border-border focus:outline-none focus:ring focus:ring-ring"
          />
        </div>

        <ConversationSidebar
          conversations={filteredConversations}
          onConversationSelect={(id) => {
            router.push(`/annotator/home/${id}`);
          }}
          selectedConversation={selectedConversation}
        />
      </div>

      <div className="flex-1 overflow-auto bg-background text-foreground">
        {!selectedConversation ? (
          <div className="p-4 text-center text-muted">
            <p className="text-lg">Select a conversation to view details</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}