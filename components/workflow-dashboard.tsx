/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
export default function WorkflowDashboard({ role }: { role: "admin" | "annotator" }) {
    const [data, setData] = useState<any>(null); const [error, setError] = useState("");
    useEffect(() => { let live = true; fetch("/api/workflow/analytics", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); if (live) setData(d); }).catch((e) => { if (live) setError(String(e)); }); return () => { live = false; }; }, []);
    if (error) return <p className="p-6 text-red-500">{error}</p>;
    if (!data) return <p className="p-6">Loading analytics...</p>;
    const c = data.counts; const cards = [["Total assigned", c.total], ["Not started", c.notStarted], ["In progress", c.inProgress], ["Completed", c.completed], ["Completion %", `${c.completionPercent.toFixed(1)}%`]];
    if (role === "admin") cards.push(["Pending", data.resolution.pending], ["Consensus", data.resolution.consensus], ["Needs admin review", data.resolution.needsReview], ["Admin resolved", data.resolution.adminResolved], ["Overall resolution %", `${data.resolution.overallPercent.toFixed(1)}%`], ["Overall agreement", data.agreement === null ? "N/A" : `${data.agreement.toFixed(1)}%`]);
    else cards.push(["Agreement with peers", data.personalAgreement === null ? "N/A" : `${data.personalAgreement.toFixed(1)}%`]);
    return <section className="p-6 space-y-6"><h1 className="text-2xl font-semibold">{role === "admin" ? "Admin" : "Annotator"} Dashboard</h1>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="rounded-lg border p-4 bg-card"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold mt-2">{value}</p></div>)}</div>
        <div className="rounded-lg border overflow-x-auto"><h2 className="font-semibold p-4">{role === "admin" ? "Agreement by conversation / assignment" : "My conversations"}</h2><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Assignment</th><th className="p-3">Conversation</th><th className="p-3">Completion</th><th className="p-3">Resolution</th><th className="p-3">Agreement</th></tr></thead><tbody>{data.records.map((r: any) => <tr key={r.assignmentId + r.id} className="border-b"><td className="p-3">{r.assignment}</td><td className="p-3">{r.title}</td><td className="p-3">{role === "admin" ? r.completion : r.personal}</td><td className="p-3">{r.resolution}</td><td className="p-3">{r.agreement === null ? "N/A" : `${r.agreement.toFixed(1)}%`}</td></tr>)}</tbody></table></div>
        {role === "admin" && <div className="rounded-lg border overflow-x-auto"><h2 className="font-semibold p-4">Agreement by question</h2><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Conversation</th><th className="p-3">Question</th><th className="p-3">Agreement</th></tr></thead><tbody>{data.records.flatMap((r: any) => r.questions.map((q: any) => <tr key={r.id + q.index} className="border-b"><td className="p-3">{r.title}</td><td className="p-3">{q.title}</td><td className="p-3">{q.agreement === null ? "N/A" : `${q.agreement}%`}</td></tr>))}</tbody></table></div>}
    </section>;
}
