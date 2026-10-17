"use client";

import { useState } from "react";

export type Filters = {
    assignmentId: string;
    annotator: string;
    completion: string;
    consensus: string;
    needsReview: string;
    adminResolved: string;
    lockStatus: string;
};
export const emptyFilters: Filters = {
    assignmentId: "all", annotator: "all", completion: "all", consensus: "all",
    needsReview: "all", adminResolved: "all", lockStatus: "all",
};
type Option = { value: string; label: string };
const completionOptions: Option[] = [
    { value: "all", label: "All" }, { value: "not-started", label: "Not Started" },
    { value: "in-progress", label: "In Progress" }, { value: "completed", label: "Completed" },
];
const yesNo: Option[] = [{ value: "all", label: "All" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }];
const specs: { key: keyof Filters; label: string; options: Option[] }[] = [
    { key: "completion", label: "Completion State", options: completionOptions },
    { key: "consensus", label: "Consensus", options: [{ value: "all", label: "All" }, { value: "pending", label: "Pending" }, { value: "reached", label: "Reached" }, { value: "not-reached", label: "Not Reached" }] },
    { key: "needsReview", label: "Needs Review", options: yesNo },
    { key: "adminResolved", label: "Admin Resolved", options: yesNo },
    { key: "lockStatus", label: "Lock Status", options: [{ value: "all", label: "All" }, { value: "locked", label: "Locked" }, { value: "unlocked", label: "Unlocked" }] },
];
export default function ConversationFilters({ mode, value, onChange, assignments = [], annotators = [] }: {
    mode: "admin" | "annotator";
    value: Filters;
    onChange: (filters: Filters) => void;
    assignments?: Option[];
    annotators?: Option[];
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<Filters>(value);
    const fields = mode === "admin" ? [
        { key: "assignmentId" as const, label: "Assignment", options: [{ value: "all", label: "All Assignments" }, ...assignments] },
        { key: "annotator" as const, label: "Annotator", options: [{ value: "all", label: "All Annotators" }, ...annotators] },
        ...specs,
    ] : [specs[0]];
    const active = fields.filter((field) => value[field.key] !== "all");
    const labelFor = (key: keyof Filters, selected: string) => fields.find((field) => field.key === key)?.options.find((option) => option.value === selected)?.label || selected;
    return <div className="border-b border-sidebar-border p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => { setDraft(value); setOpen(!open); }} className="font-semibold hover:underline">⚙ Filters ({active.length})</button>
            <button type="button" onClick={() => { onChange({ ...emptyFilters }); setDraft({ ...emptyFilters }); }} className="text-xs text-muted-foreground hover:underline">Clear</button>
        </div>
        {!!active.length && <div className="flex flex-wrap gap-1 mt-3">{active.map((field) => <button key={field.key} type="button" onClick={() => { const next = { ...value, [field.key]: "all" }; onChange(next); setDraft(next); }} className="rounded-full border border-border bg-secondary px-2 py-1 text-xs">{labelFor(field.key, value[field.key])} ×</button>)}</div>}
        {open && <div className="mt-4 rounded-md border border-border bg-background p-3 space-y-3">
            <div className="flex justify-between font-semibold"><span>Filters</span><button type="button" onClick={() => setOpen(false)} aria-label="Close filters">×</button></div>
            {fields.map((field) => <label key={field.key} className="block"><span className="block mb-1 text-xs font-medium">{field.label}</span><select className="w-full rounded border border-border bg-background text-foreground p-2" value={draft[field.key]} onChange={(event) => setDraft((old) => ({ ...old, [field.key]: event.target.value, ...(field.key === "assignmentId" ? { annotator: "all" } : {}) }))}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
            <div className="flex gap-2 pt-2"><button type="button" className="flex-1 rounded border border-border p-2" onClick={() => setDraft({ ...emptyFilters })}>Reset Filters</button><button type="button" className="flex-1 rounded bg-primary text-primary-foreground p-2" onClick={() => { onChange(draft); setOpen(false); }}>Apply</button></div>
        </div>}
    </div>;
}
