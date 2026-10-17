"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ConversationSidebar from "@/components/conversation-sidebar";
import ConversationFilters, { emptyFilters, Filters } from "@/components/conversation-filters";
import { useDatabase } from "@/components/context/database-context";
import type { Conversation } from "@/types/conversations";

type AssignmentItem = { _id: string; title: string; annotators: string[] };
type AdminItem = Conversation & { assignmentId: string | null; annotators: string[]; completion: string; consensus: string; needsReview: boolean; adminResolved: boolean; locked: boolean; perAnnotatorCompletion: Record<string, string>; firstInteraction: string; lastInteraction: string };
export default function HomeLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { activeDatabase } = useDatabase();
    const [conversations, setConversations] = useState<AdminItem[]>([]);
    const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
    const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [error, setError] = useState("");
    const selectedConversation = pathname.match(/^\/admin\/home\/([^/]+)/)?.[1] || null;
    useEffect(() => {
        setFilters({ ...emptyFilters });
        if (!activeDatabase) { setConversations([]); setAssignments([]); return; }
        const controller = new AbortController();
        fetch(`/api/admin/conversation-filters?name=${encodeURIComponent(activeDatabase.name)}`, { cache: "no-store", signal: controller.signal })
            .then(async (response) => { if (!response.ok) throw new Error("Could not load conversations"); return response.json(); })
            .then((data) => { setConversations(data.conversations || []); setAssignments(data.assignments || []); setError(""); })
            .catch((err) => { if (!controller.signal.aborted) { setError(err.message); setConversations([]); } });
        return () => controller.abort();
    }, [activeDatabase]);
    const relevantAnnotators = useMemo(() => [...new Set(assignments.filter((assignment) => filters.assignmentId === "all" || assignment._id === filters.assignmentId).flatMap((assignment) => assignment.annotators))].sort(), [assignments, filters.assignmentId]);
    const filtered = useMemo(() => conversations.filter((item) => {
        if (query && !`${item.title} ${item.person}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (filters.assignmentId !== "all" && item.assignmentId !== filters.assignmentId) return false;
        if (filters.annotator !== "all" && !item.annotators.includes(filters.annotator)) return false;
        const status = filters.annotator === "all" ? item.completion : item.perAnnotatorCompletion[filters.annotator];
        if (filters.completion !== "all" && status !== filters.completion) return false;
        if (filters.consensus !== "all" && item.consensus !== filters.consensus) return false;
        if (filters.needsReview !== "all" && item.needsReview !== (filters.needsReview === "yes")) return false;
        if (filters.adminResolved !== "all" && item.adminResolved !== (filters.adminResolved === "yes")) return false;
        if (filters.lockStatus !== "all" && item.locked !== (filters.lockStatus === "locked")) return false;
        return true;
    }), [conversations, filters, query]);
    const sidebarItems = filtered.map((item) => ({ ...item, stime: { text: item.firstInteraction, timestamp: 0 }, last_interact: { text: item.lastInteraction, timestamp: 0 }, annotationProgress: { status: (filters.annotator === "all" ? item.completion : item.perAnnotatorCompletion[filters.annotator]) as "completed" | "in-progress" | "not-started" } }));
    return <div className="flex flex-row bg-background text-foreground">
        <div className="w-80 shrink-0 border-r border-sidebar-border">
            <div className="p-4 border-b border-sidebar-border"><input className="w-full p-2 rounded-md bg-input text-foreground border border-border" placeholder="Search conversations..." value={search} onChange={(event) => { setSearch(event.target.value); setQuery(event.target.value); }} /></div>
            <ConversationFilters mode="admin" value={filters} onChange={setFilters} assignments={assignments.map((item) => ({ value: item._id, label: item.title }))} annotators={relevantAnnotators.map((name) => ({ value: name, label: name }))} />
            {error && <p role="alert" className="p-3 text-sm text-red-600">{error}</p>}
            <ConversationSidebar conversations={sidebarItems} statusMode="all-annotators" selectedConversation={selectedConversation} onConversationSelect={(id) => router.push(`/admin/home/${id}`)} />
        </div>
        <div className="flex-1 overflow-auto bg-background text-foreground">{selectedConversation ? children : <p className="p-4 text-center">Select a conversation to view details</p>}</div>
    </div>;
}
