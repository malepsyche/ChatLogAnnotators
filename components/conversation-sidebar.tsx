"use client";

import React, { useEffect, useState } from "react";
import CueCard from "./cue-card";
import { Conversation, Annotation } from "@/types/conversations";

interface ConvSidebarProps {
  conversations: Conversation[];
  onConversationSelect: (conversationId: string) => void;
  selectedConversation: string | null;
  statusMode?: "current-user" | "all-annotators";
}

type Status = "completed" | "in-progress" | "not-started";
type SidebarConversation = Conversation & {
  annotationProgress?: { status: Status };
  stime?: { text: string };
  last_interact?: { text: string };
  person?: string;
};

function localStatus(conv: Conversation, username?: string): Status {
  if (!username) return "not-started";
  const annotations: Annotation[] = [
    ...(conv.annotations || []),
    ...(conv.messages || []).flatMap((message) => message.annotations || []),
  ];
  if (annotations.length === 0) return "not-started";
  const answered = annotations.filter((annotation) =>
    annotation.answers?.some((answer) =>
      typeof answer === "object" && answer !== null && answer.name === username
    )
  ).length;
  if (answered === annotations.length) return "completed";
  return answered > 0 ? "in-progress" : "not-started";
}

const ConversationSidebar: React.FC<ConvSidebarProps> = ({
  conversations,
  onConversationSelect,
  selectedConversation,
  statusMode = "current-user",
}) => {
  const [username, setUsername] = useState<string>();
  useEffect(() => {
    const raw = document.cookie.split("; ").find((row) => row.startsWith("username="))?.split("=")[1];
    setUsername(raw ? decodeURIComponent(raw) : undefined);
  }, []);

  return (
    <div className="w-80 h-screen overflow-y-scroll bg-sidebar text-sidebar-foreground resize-x overflow-auto p-4 border-r border-sidebar-border">
      <h2 className="text-lg font-semibold mb-4 tracking-wide">Conversations</h2>
      {conversations.length ? conversations.map((conv) => {
        const display = conv as SidebarConversation;
        const status = statusMode === "all-annotators"
          ? display.annotationProgress?.status ?? "not-started"
          : localStatus(conv, username);
        return (
          <CueCard
            key={conv._id}
            title={conv.title || "Untitled"}
            person={display.person || "Unknown"}
            firstInteraction={display.stime?.text || "Unknown Start Time"}
            lastInteraction={display.last_interact?.text || "Unknown Last Interaction"}
            onClick={() => onConversationSelect(conv._id)}
            isActive={conv._id === selectedConversation}
            isAnnotatedByUser={status === "completed"}
            isInProgress={status === "in-progress"}
          />
        );
      }) : <div className="text-sm text-center text-gray-500 mt-8">Cannot find conversation</div>}
    </div>
  );
};

export default ConversationSidebar;
