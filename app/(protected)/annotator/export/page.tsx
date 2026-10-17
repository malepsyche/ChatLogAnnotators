"use client";

import { useEffect, useMemo, useState } from "react";
import { useAssignment } from "@/components/context/assignment-context";
import ConversationSidebar from "@/components/conversation-sidebar";
import type { Conversation } from "@/types/conversations";

type ExportItem = Conversation & {
    firstInteraction: string;
    lastInteraction: string;
    completion: string;
    annotators: string[];
};

export default function ExportPage() {
    const { activeAssignment, activeDatabase } = useAssignment();

    const [items, setItems] = useState<ExportItem[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        setItems([]);
        setSelected([]);
        setError("");

        if (!activeAssignment) {
            return;
        }

        const controller = new AbortController();

        const loadConversations = async () => {
            try {
                const params = new URLSearchParams({
                    assignmentId: activeAssignment
                });

                const response = await fetch(
                    `/api/annotators/conversation-filters?${params.toString()}`,
                    { signal: controller.signal }
                );

                if (!response.ok) {
                    throw new Error("Failed to load conversations");
                }

                const data = await response.json();

                if (!controller.signal.aborted) {
                    setItems(data.conversations || []);
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setError(String(error));
                }
            }
        };

        void loadConversations();

        return () => controller.abort();
    }, [activeAssignment]);

    const visible = useMemo(() => {
        return items.filter((item) => {
            const text = `${item.title} ${item.person}`.toLowerCase();
            return text.includes(query.toLowerCase());
        });
    }, [items, query]);

    const toggle = (id: string) => {
        setSelected((current) => {
            if (current.includes(id)) {
                return current.filter((value) => value !== id);
            }

            return [...current, id];
        });
    };

    const selectAll = () => {
        setSelected(visible.map((item) => String(item._id)));
    };

    const clearSelection = () => {
        setSelected([]);
    };

    const download = () => {
        if (!activeDatabase || selected.length === 0) {
            return;
        }

        const params = new URLSearchParams({
            format: "json",
            databaseId: activeDatabase
        });

        selected.forEach((id) => {
            params.append("conversationId", id);
        });

        window.location.href = `/api/workflow/export?${params.toString()}`;
    };

    const sidebarItems = visible.map((item) => ({
        ...item,
        stime: {
            text: item.firstInteraction,
            timestamp: 0
        },
        last_interact: {
            text: item.lastInteraction,
            timestamp: 0
        },
        annotationProgress: {
            status:
                item.completion === "completed"
                    ? "completed" as const
                    : item.completion === "in_progress"
                        ? "in-progress" as const
                        : "not-started" as const
        }
    }));

    return (
        <div className="flex h-full min-h-[75vh] bg-background text-foreground">
            <div className="w-80 shrink-0 border-r border-border">
                <div className="p-4">
                    <input
                        className="w-full rounded-md border border-border bg-input p-2"
                        placeholder="Search conversations..."
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>

                <p className="px-4 pb-2 text-sm">
                    Click a conversation card to select it for export.
                </p>

                <ConversationSidebar
                    conversations={sidebarItems}
                    statusMode="all-annotators"
                    selectedConversation={null}
                    onConversationSelect={toggle}
                />
            </div>

            <main className="flex-1 space-y-5 p-6">
                <h1 className="text-2xl font-semibold">
                    Export Conversations
                </h1>

                {error && (
                    <p role="alert" className="text-red-500">
                        {error}
                    </p>
                )}

                <p>
                    {selected.length} conversation
                    {selected.length === 1 ? "" : "s"} selected
                </p>

                <div className="flex flex-wrap gap-2">
                    {selected.map((id) => {
                        const item = items.find(
                            (entry) => String(entry._id) === id
                        );

                        return (
                            <button
                                key={id}
                                onClick={() => toggle(id)}
                                className="rounded-md border px-3 py-2 text-sm"
                            >
                                {item?.title || id} ×
                            </button>
                        );
                    })}
                </div>

                <button
                    className="rounded border p-3 disabled:opacity-50"
                    disabled={!activeDatabase || selected.length === 0}
                    onClick={download}
                >
                    Export Selected Conversations (JSON)
                </button>

                <div className="flex gap-4">
                    <button
                        className="text-sm underline"
                        onClick={selectAll}
                    >
                        Select all visible
                    </button>

                    <button
                        className="text-sm underline"
                        onClick={clearSelection}
                    >
                        Clear selection
                    </button>
                </div>
            </main>
        </div>
    );
}