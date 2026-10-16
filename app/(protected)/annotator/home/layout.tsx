"use client";

import { ReactNode, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ConversationSidebar from "@/components/conversation-sidebar";
import { Conversation } from "@/types/conversations";
import { useAssignment } from "@/components/context/assignment-context";

export default function HomeLayout({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [filteredConversations, setFilteredConversations] = useState<
    Conversation[]
  >([]);
  const [tempQuery, setTempQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const router = useRouter();
  const { activeAssignment } = useAssignment();

  useEffect(() => {
    const username = document.cookie
      .split("; ")
      .find((row) => row.startsWith("username="))
      ?.split("=")[1];

    if (!activeAssignment || !username) return;

    const fetchConversations = async () => {
      try {
        const queryParam = searchQuery
          ? `&query=${encodeURIComponent(searchQuery)}`
          : "";
        console.log(
          "[HomeLayout] Fetching conversations for assignment:",
          activeAssignment
        );

        const response = await fetch(
          `/api/conversations/annotators?username=${username}&assignmentTitle=${encodeURIComponent(
            activeAssignment
          )}${queryParam}`
        );

        const data = await response.json();

        if (Array.isArray(data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedData = data.map((chatlog: any) => ({
            _id: chatlog._id || "unknown_id",
            title: chatlog.title || "Untitled",
            stime: chatlog.firstInteraction
              ? {
                  text: new Date(chatlog.firstInteraction).toLocaleString(),
                  timestamp: new Date(chatlog.firstInteraction).getTime(),
                }
              : { text: "Unknown Start Time", timestamp: 0 },

            last_interact: chatlog.lastInteraction
              ? {
                  text: new Date(chatlog.lastInteraction).toLocaleString(),
                  timestamp: new Date(chatlog.lastInteraction).getTime(),
                }
              : { text: "Unknown Last Interaction", timestamp: 0 },

            person: chatlog.Person || "Unknown Person",
            messages: chatlog.messages || [],
            annotations: chatlog.annotations || [],
          }));

          setConversations(transformedData);
          setFilteredConversations(transformedData);
        } else {
          console.error("[HomeLayout] Expected an array but got:", data);
          setConversations([]);
          setFilteredConversations([]);
        }
      } catch (error) {
        console.error("[HomeLayout] Error fetching conversations:", error);
        setConversations([]);
        setFilteredConversations([]);
      }
    };

    fetchConversations();
  }, [searchQuery, activeAssignment]);

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
            setSelectedConversation(id);
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