import { NextResponse } from "next/server";
import { requireRole } from "@/lib/workflow";
import { getSystemDatabase } from "@/lib/cosmosdb";

export async function GET() {
    try {
        await requireRole("admin");
        const db = await getSystemDatabase();
        const rows = await db.collection("audit_events")
            .find({})
            .sort({ createdAt: -1 })
            .limit(300)
            .toArray();

        return NextResponse.json(rows.map((row) => ({
            ...row,
            _id: String(row._id)
        })));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 403 });
    }
}
