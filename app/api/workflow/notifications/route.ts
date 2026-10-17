import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole } from "@/lib/workflow";
import { getSystemDatabase } from "@/lib/cosmosdb";

export async function GET() {
    try {
        const user = await requireRole();
        const db = await getSystemDatabase();

        const rows = await db.collection("notifications")
            .find({
                username: user.username,
                $or: [
                    { "details.collection": "conversations" },
                    { action: /^annotation\./ },
                    { action: /^conversation\./ },
                    { action: /^conversations\./ },
                    { action: /^comment\./ },
                    { action: /^resolution\./ }
                ]
            })
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();

        return NextResponse.json(
            rows.map((row) => ({
                ...row,
                _id: String(row._id)
            }))
        );
    } catch (error) {
        return NextResponse.json(
            { error: String(error) },
            { status: 403 }
        );
    }
}

export async function PATCH(req: Request) {
    try {
        const user = await requireRole();
        const { id } = await req.json();

        if (typeof id !== "string" || !ObjectId.isValid(id)) {
            throw new Error("Invalid notification");
        }

        const db = await getSystemDatabase();
        await db.collection("notifications").updateOne(
            { _id: new ObjectId(id), username: user.username },
            { $set: { read: true } }
        );

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
