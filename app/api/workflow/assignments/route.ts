import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole, recordEvent, allAssignments, withConversationCollection, getDatabaseMeta } from "@/lib/workflow";
import { getAssignmentCollection, getUserCollection } from "@/lib/cosmosdb";
export async function GET(req: Request) {
    try { await requireRole("admin"); const databaseId = new URL(req.url).searchParams.get("databaseId") || undefined;
        const assignments = await allAssignments(databaseId); return NextResponse.json(assignments.map((a) => ({ ...a, _id: String(a._id) })));
    } catch (e) { return NextResponse.json({ error: String(e) }, { status: 403 }); }
}
export async function POST(req: Request) {
    try {
        const user = await requireRole("admin"); const body = await req.json();
        const title = String(body.title || "").trim(); const databaseId = String(body.databaseId || "");
        const conversations: string[] = [...new Set<string>((body.conversations || []).map((id: unknown) => String(id)))];
        const annotators: string[] = [...new Set<string>((body.annotators || []).map((name: unknown) => String(name)))];
        if (!title || !ObjectId.isValid(databaseId) || !conversations.every((c) => ObjectId.isValid(c))) throw new Error("Invalid assignment fields");
        await getDatabaseMeta(databaseId);
        const users = await (await getUserCollection()).find({ username: { $in: annotators }, role: "annotator" }).toArray();
        if (users.length !== annotators.length) throw new Error("Unknown annotator");
        const collection = await getAssignmentCollection();
        if (conversations.length && await collection.findOne({ databaseId, conversations: { $in: conversations } })) throw new Error("Conversation already assigned");
        const found = await withConversationCollection(databaseId, async (c) => c.countDocuments({ _id: { $in: conversations.map((id) => new ObjectId(id)) } }));
        if (found !== conversations.length) throw new Error("Some conversations do not exist");
        const result = await collection.insertOne({ title, databaseId, conversations, annotators, lock: { isLocked: false, lockedBy: null, lockedAt: null }, createdAt: new Date() });
        await recordEvent(user.username, "assignment.created", String(result.insertedId), { title, databaseId, conversations, annotators }, annotators);
        return NextResponse.json({ id: String(result.insertedId) }, { status: 201 });
    } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
