import React from "react";
import CueCard from "./cue-card";

interface Conversation {
  _id: string;
  title: string;
  person: string;
  firstInteraction: string;
  lastInteraction: string;
}

interface ConvSidebarProps {
  conversations: Conversation[];
  onConversationSelect: (conversationId: string) => void;
}

const ConversationSidebar: React.FC<ConvSidebarProps> = ({ conversations, onConversationSelect }) => {
  return (
    <div
      className="w-80 h-screen overflow-y-scroll bg-black text-white resize-x overflow-auto p-4"
    >
      <h2 className="text-lg font-semibold mb-4">Conversations</h2>
      {conversations.map((conv) => (
        <CueCard
          key={conv._id}
          person={conv.person}
          title={conv.title}
          firstInteraction={conv.firstInteraction}
          lastInteraction={conv.lastInteraction}
          onClick={() => onConversationSelect(conv._id)}
        />
      ))}
    </div>
  );
};

export default ConversationSidebar;
