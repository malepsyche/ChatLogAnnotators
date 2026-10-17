/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getAssignmentCollection } from "@/lib/cosmosdb";
import { requireRole, withConversationCollection, assess, personalStatus, annotationsOf, answerFor, same } from "@/lib/workflow";
export async function GET(req: Request) {
    try {
        const user = await requireRole(); const url = new URL(req.url);
        const databaseId = url.searchParams.get("databaseId") || undefined;
        const assignments = await (await getAssignmentCollection()).find({ ...(databaseId ? { databaseId } : {}), ...(user.role === "annotator" ? { annotators: user.username } : {}) }).toArray();
        const records: any[] = [];
        for (const assignment of assignments) {
            const ids = (assignment.conversations || []).filter((id: string) => ObjectId.isValid(id));
            if (!ids.length) continue;
            const docs = await withConversationCollection(assignment.databaseId, async (c) => c.find({ _id: { $in: ids.map((id: string) => new ObjectId(id)) } }).toArray());
            for (const doc of docs) {
                const status = assess(doc, assignment.annotators || []);
                const personal = personalStatus(doc, user.username);
                const comparisons: boolean[] = [];
                if (user.role === "annotator") for (const q of annotationsOf(doc)) {
                    const mine = answerFor(q, user.username);
                    if (!mine) continue;
                    for (const other of (assignment.annotators || []).filter((n: string) => n !== user.username)) {
                        const theirs = answerFor(q, other); if (theirs) comparisons.push(same(mine, theirs));
                    }
                }
                records.push({ id: String(doc._id), title: doc.title || doc.person || "Untitled", assignmentId: String(assignment._id), assignment: assignment.title, annotators: assignment.annotators, locked: !!assignment.lock?.isLocked || !!doc.lock?.isLocked, ...status, personal, comparisons, questions: status.questions });
            }
        }
        const total = records.length;
        const completionKey = user.role === "admin" ? "completion" : "personal";
        const completed = records.filter((r) => r[completionKey] === "completed").length;
        const counts = { total, notStarted: records.filter((r) => r[completionKey] === "not_started").length, inProgress: records.filter((r) => r[completionKey] === "in_progress").length, completed, completionPercent: total ? 100 * completed / total : 0 };
        const resolved = records.filter((r) => ["consensus", "admin_resolved"].includes(r.resolution)).length;
        const resolution = { pending: records.filter((r) => r.resolution === "pending").length, consensus: records.filter((r) => r.resolution === "consensus").length, needsReview: records.filter((r) => r.resolution === "needs_review").length, adminResolved: records.filter((r) => r.resolution === "admin_resolved").length, overallPercent: total ? 100 * resolved / total : 0 };
        const comparable = records.reduce((n, r) => n + r.comparable, 0);
        const agreed = records.reduce((n, r) => n + r.agreed, 0);
        const comparisons = records.flatMap((r) => r.comparisons);
        return NextResponse.json({ counts, resolution, agreement: comparable ? agreed / comparable * 100 : null, personalAgreement: comparisons.length ? comparisons.filter(Boolean).length / comparisons.length * 100 : null, records });
    } catch (e) { return NextResponse.json({ error: String(e) }, { status: 403 }); }
}
