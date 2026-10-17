import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getAssignmentCollection, getUserCollection } from "@/lib/cosmosdb";
import { requireRole, recordEvent, withConversationCollection } from "@/lib/workflow";
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireRole("admin"); const { id } = await context.params;
        if (!ObjectId.isValid(id)) throw new Error("Invalid assignment ID");
        const collection = await getAssignmentCollection(); const existing = await collection.findOne({ _id: new ObjectId(id) });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const body = await req.json(); const changes: Record<string, unknown> = {};
        if (body.title !== undefined) { if (!String(body.title).trim()) throw new Error("Title required"); changes.title = String(body.title).trim(); }
        if (body.annotators !== undefined) {
            if (!Array.isArray(body.annotators)) throw new Error("Invalid annotators");
            const names: string[] = [...new Set(body.annotators.map(String))];
            const users = await (await getUserCollection()).find({ username: { $in: names }, role: "annotator" }).toArray();
            if (users.length !== names.length) throw new Error("Unknown annotator"); changes.annotators = names;
        }
        if (body.conversations !== undefined) {
            if (!Array.isArray(body.conversations)) throw new Error("Invalid conversations");
            const ids: string[] = [...new Set(body.conversations.map(String))];
            if (!ids.every((v) => ObjectId.isValid(v))) throw new Error("Invalid conversation ID");
            if (ids.length && await collection.findOne({ _id: { $ne: new ObjectId(id) }, databaseId: existing.databaseId, conversations: { $in: ids } })) throw new Error("Conversation already assigned");
            const found = await withConversationCollection(existing.databaseId, async (c) => c.countDocuments({ _id: { $in: ids.map((v) => new ObjectId(v)) } }));
            if (found !== ids.length) throw new Error("Unknown conversation"); changes.conversations = ids;
        }
        if (body.isLocked !== undefined) {
            if (typeof body.isLocked !== "boolean") throw new Error("Invalid lock state");
            changes.lock = { isLocked: body.isLocked, lockedBy: body.isLocked ? user.username : null, lockedAt: body.isLocked ? Date.now() : null };
        }
        await collection.updateOne({ _id: existing._id }, { $set: { ...changes, updatedAt: new Date() } });
        await recordEvent(user.username, "assignment.updated", id, { before: { title: existing.title, annotators: existing.annotators, conversations: existing.conversations, lock: existing.lock }, changes }, [...new Set([...(existing.annotators || []), ...((changes.annotators as string[]) || [])])]);
        return NextResponse.json({ ok: true });
    } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
