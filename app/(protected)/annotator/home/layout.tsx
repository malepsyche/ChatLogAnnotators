"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ConversationSidebar from "@/components/conversation-sidebar";
import ConversationFilters, { emptyFilters, Filters } from "@/components/conversation-filters";
import { completion } from "@/lib/conversation-filter-status";
import { useAssignment } from "@/components/context/assignment-context";
import type { Conversation } from "@/types/conversations";

export default function HomeLayout({ children }: { children: ReactNode }) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();
    const pathname = usePathname();
    const { activeAssignment } = useAssignment();
    const selectedConversation = pathname.match(/^\/annotator\/home\/([^/]+)/)?.[1] || null;
    const username = typeof document !== "undefined" ? decodeURIComponent(document.cookie.split("; ").find((part) => part.startsWith("username="))?.split("=")[1] || "") : "";
    useEffect(() => {
        setFilters({ ...emptyFilters });
        if (!activeAssignment) { setConversations([]); return; }
        const controller = new AbortController();
        fetch(`/api/conversations/annotators?assignmentId=${encodeURIComponent(activeAssignment)}`, { cache: "no-store", signal: controller.signal })
            .then(async (response) => { if (!response.ok) throw new Error("Could not load conversations"); return response.json(); })
            .then((data) => { setConversations(data); setError(""); })
            .catch((err) => { if (!controller.signal.aborted) { setConversations([]); setError(err.message); } });
        router.push("/annotator/home");
        return () => controller.abort();
    }, [activeAssignment, router]);
    const filtered = useMemo(() => conversations.filter((item) => {
        if (search && !`${item.title} ${item.person || item.Person || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
        return filters.completion === "all" || completion(item, username) === filters.completion;
    }), [conversations, filters.completion, search, username]);
    return <div className="flex flex-row bg-background text-foreground">
        <div className="w-80 shrink-0 border-r border-sidebar-border">
            <div className="p-4 border-b border-sidebar-border"><input className="w-full p-2 rounded-md bg-input text-foreground border border-border" placeholder="Search conversations..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <ConversationFilters mode="annotator" value={filters} onChange={setFilters} />
            {error && <p role="alert" className="p-3 text-sm text-red-600">{error}</p>}
            <ConversationSidebar conversations={filtered.map((item) => ({ ...item, stime: { text: (item as Conversation & { firstInteraction?: string }).firstInteraction || "", timestamp: 0 }, last_interact: { text: (item as Conversation & { lastInteraction?: string }).lastInteraction || "", timestamp: 0 } }))} selectedConversation={selectedConversation} onConversationSelect={(id) => router.push(`/annotator/home/${id}`)} />
        </div>
        <div className="flex-1 overflow-auto bg-background text-foreground">{selectedConversation ? children : <p className="p-4 text-center">Select a conversation to view details</p>}</div>
    </div>;
}
