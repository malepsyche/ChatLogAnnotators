/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireRole, withConversationCollection } from "@/lib/workflow";
export async function GET(req: Request) {
    try {
        await requireRole("admin"); const databaseId = new URL(req.url).searchParams.get("databaseId") || "";
        const docs = await withConversationCollection(databaseId, async (c) => c.find({}, { projection: { title: 1, person: 1 } }).limit(2000).toArray());
        return NextResponse.json(docs.map((d: any) => ({ id: String(d._id), title: d.title || d.person || String(d._id) })));
    } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
