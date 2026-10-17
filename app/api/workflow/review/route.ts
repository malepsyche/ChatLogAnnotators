/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole, withConversationCollection, recordEvent } from "@/lib/workflow";
import { getAssignmentCollection } from "@/lib/cosmosdb";
export async function PATCH(req: Request) {
    try {
        const user = await requireRole("admin"); const { assignmentId, conversationId, questionIndex, content } = await req.json();
        if (![assignmentId, conversationId].every((v) => ObjectId.isValid(v)) || !Number.isInteger(questionIndex) || questionIndex < 0 || !Array.isArray(content) || !content.every((v) => typeof v === "string")) throw new Error("Invalid resolution");
        const assignment = await (await getAssignmentCollection()).findOne({ _id: new ObjectId(assignmentId), conversations: conversationId });
        if (!assignment) throw new Error("Conversation not in assignment");
        const before = await withConversationCollection(assignment.databaseId, async (c) => {
            const doc = await c.findOne({ _id: new ObjectId(conversationId) });
            if (!doc) throw new Error("Conversation not found");
            const count = (doc.annotations || []).length;
            let path: string;
            if (questionIndex < count) path = `annotations.${questionIndex}.adminResolution`;
            else { let n = questionIndex - count; let found = "";
                (doc.messages || []).forEach((m: any, i: number) => { if (found) return; if (n < (m.annotations || []).length) found = `messages.${i}.annotations.${n}.adminResolution`; else n -= (m.annotations || []).length; });
                if (!found) throw new Error("Question not found"); path = found;
            }
            const old = path.split(".").reduce((o: any, k) => o?.[k], doc);
            await c.updateOne({ _id: doc._id }, { $set: { [path]: { content, name: user.username, timestamp: Date.now() } } });
            return old || null;
        });
        await recordEvent(user.username, "resolution.updated", conversationId, { assignmentId, questionIndex, before, content }, assignment.annotators || []);
        return NextResponse.json({ ok: true });
    } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
