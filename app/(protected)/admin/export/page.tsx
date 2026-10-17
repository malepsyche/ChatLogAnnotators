"use client";

import { useEffect, useMemo, useState } from "react";
import { useDatabase } from "@/components/context/database-context";
import ConversationSidebar from "@/components/conversation-sidebar";
import type { Conversation } from "@/types/conversations";

type ExportItem = Conversation & { firstInteraction: string; lastInteraction: string; completion: string; annotators: string[] };

export default function ExportPage() {
    const { activeDatabase } = useDatabase();
    const [items, setItems] = useState<ExportItem[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const [error, setError] = useState("");
    useEffect(() => {
        setItems([]);
        setSelected([]);
        if (!activeDatabase) return;
        const controller = new AbortController();
        fetch(`/api/admin/conversation-filters?name=${encodeURIComponent(activeDatabase.name)}`, { signal: controller.signal })
            .then(async (response) => { if (!response.ok) throw new Error("Failed to load conversations"); return response.json(); })
            .then((data) => { setItems(data.conversations || []); setError(""); })
            .catch((cause) => { if (!controller.signal.aborted) setError(String(cause)); });
        return () => controller.abort();
    }, [activeDatabase]);
    const visible = useMemo(() => items.filter((item) => `${item.title} ${item.person}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
    const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    const download = () => {
        if (!activeDatabase || selected.length === 0) {
            return;
        }
        const params = new URLSearchParams({
            format: "json",
            databaseId: activeDatabase.name
        });
        selected.forEach((id) => {
            params.append("conversationId", id);
        });
        window.location.href = `/api/workflow/export?${params.toString()}`;
    };
    const sidebarItems = visible.map((item) => ({ ...item, stime: { text: item.firstInteraction, timestamp: 0 }, last_interact: { text: item.lastInteraction, timestamp: 0 }, annotationProgress: { status: item.completion === "completed" ? "completed" as const : item.completion === "in_progress" ? "in-progress" as const : "not-started" as const } }));
    return <div className="flex h-full min-h-[75vh] bg-background text-foreground">
        <div className="w-80 shrink-0 border-r border-border">
            <div className="p-4"><input className="w-full rounded-md border border-border bg-input p-2" placeholder="Search conversations..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <p className="px-4 pb-2 text-sm">Click a conversation card to select it for export.</p>
            <ConversationSidebar conversations={sidebarItems} statusMode="all-annotators" selectedConversation={null} onConversationSelect={toggle} />
        </div>
        <main className="flex-1 space-y-5 p-6">
            <h1 className="text-2xl font-semibold">Export Annotations</h1>
            {error && <p role="alert" className="text-red-500">{error}</p>}
            <p>{selected.length} conversation{selected.length === 1 ? "" : "s"} selected</p>
            <div className="flex flex-wrap gap-2">{selected.map((id) => { const item = items.find((entry) => String(entry._id) === id); return <button key={id} onClick={() => toggle(id)} className="rounded-md border px-3 py-2 text-sm">{item?.title || id} ×</button>; })}</div>
            <button
                className="rounded border p-3 disabled:opacity-50"
                disabled={!selected.length}
                onClick={download}
            >
                Export (JSON)
            </button>
        </main>
    </div>;
}
