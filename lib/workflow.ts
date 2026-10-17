/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId, MongoClient, Document } from "mongodb";
import { auditedCollection } from "@/lib/audited-collection";
import { getAssignmentCollection, getDatabaseCollection, getSystemDatabase } from "@/lib/cosmosdb";
import { getRequestUser } from "@/lib/annotationLock";

export async function requireRole(role?: "admin" | "annotator") {
    const user = await getRequestUser();
    if (!user || (role && user.role !== role)) throw new Error("Forbidden");
    return user;
}
export async function getDatabaseMeta(databaseId: string) {
    if (!ObjectId.isValid(databaseId)) throw new Error("Invalid database ID");
    const db = await (await getDatabaseCollection()).findOne({ _id: new ObjectId(databaseId) });
    if (!db) throw new Error("Database not found");
    return db;
}
export async function withConversationCollection<T>(databaseId: string, fn: (collection: any) => Promise<T>): Promise<T> {
    const db = await getDatabaseMeta(databaseId);
    const client = new MongoClient(db.uri);
    try {
        await client.connect();
        return await fn(auditedCollection(client.db(db.databaseId).collection(db.containerId), getSystemDatabase));
    } finally { await client.close(); }
}
export async function recordEvent(
    actor: string,
    action: string,
    target: string,
    details: Document = {},
    recipients: string[] = []
) {
    const db = await getSystemDatabase();
    const now = new Date();

    // Always record the event in Audit History.
    await db.collection("audit_events").insertOne({
        actor,
        action,
        target,
        details,
        createdAt: now
    });

    // Only conversation and annotation events generate notifications.
    const shouldNotify =
        action.startsWith("annotation.") ||
        action.startsWith("conversation.") ||
        action.startsWith("conversations.");

    if (!shouldNotify) {
        return;
    }

    const users = [...new Set(recipients)].filter(
        (name) => name && name !== actor
    );

    if (users.length === 0) {
        return;
    }

    await db.collection("notifications").insertMany(
        users.map((username) => ({
            username,
            actor,
            action,
            target,
            details,
            read: false,
            createdAt: now
        }))
    );
}

export function annotationsOf(doc: any): any[] {
    return [...(doc.annotations || []), ...(doc.messages || []).flatMap((m: any) => m.annotations || [])];
}
export function answerFor(question: any, username: string): string[] | null {
    const answers = (question.answers || []).filter((a: any) => a && typeof a === "object" && a.name === username && Array.isArray(a.content));
    if (!answers.length) return null;
    const latest = answers.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))[0];
    return latest.content.map(String).sort();
}
export function same(a: string[], b: string[]) { return JSON.stringify(a) === JSON.stringify(b); }
export function personalStatus(doc: any, username: string) {
    const questions = annotationsOf(doc);
    const answered = questions.filter((q) => answerFor(q, username) !== null).length;
    return !answered ? "not_started" : answered === questions.length ? "completed" : "in_progress";
}
export function assess(doc: any, annotators: string[]) {
    const questions = annotationsOf(doc);
    let comparable = 0, agreed = 0, unresolved = 0, resolved = 0, pending = 0;
    const byQuestion = questions.map((q: any, index: number) => {
        const answers = annotators.map((a) => answerFor(q, a));
        const complete = answers.every((a) => a !== null);
        const comparison = answers.filter((a): a is string[] => a !== null);
        const comparableQuestion = comparison.length >= 2;
        const consensus = comparableQuestion && comparison.every((a) => same(a, comparison[0]));
        const adminResolved = !!q.adminResolution?.content;
        if (comparableQuestion && complete) { comparable++; if (consensus) agreed++; }
        if (!complete) pending++;
        else if (!consensus && !adminResolved) unresolved++;
        else if (!consensus && adminResolved) resolved++;
        return { index, title: q.title || `Question ${index + 1}`, complete, consensus, adminResolved, needsReview: complete && !consensus && !adminResolved, agreement: comparableQuestion && complete ? (consensus ? 100 : 0) : null, answers: Object.fromEntries(annotators.map((a, i) => [a, answers[i]])) };
    });
    const statuses = annotators.map((a) => personalStatus(doc, a));
    const completion = statuses.every((s) => s === "completed") ? "completed" : statuses.every((s) => s === "not_started") ? "not_started" : "in_progress";
    const resolution = pending ? "pending" : unresolved ? "needs_review" : resolved ? "admin_resolved" : "consensus";
    return { completion, resolution, agreement: comparable ? agreed / comparable * 100 : null, comparable, agreed, questions: byQuestion };
}
export async function allAssignments(databaseId?: string) {
    return (await getAssignmentCollection()).find(databaseId ? { databaseId } : {}).toArray();
}
