import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireRole, withConversationCollection } from "@/lib/workflow";
import { getAssignmentCollection } from "@/lib/cosmosdb";

export async function GET(req: Request) {
    try {
        const user = await requireRole();

        const url = new URL(req.url);
        const format = url.searchParams.get("format") || "json";
        const databaseId = url.searchParams.get("databaseId");
        const selectedIds = url.searchParams.getAll("conversationId");

        if (format !== "json") {
            return NextResponse.json(
                { error: "Original-schema export only supports JSON" },
                { status: 400 }
            );
        }

        if (!databaseId || !ObjectId.isValid(databaseId)) {
            return NextResponse.json(
                { error: "Invalid database ID" },
                { status: 400 }
            );
        }

        if (selectedIds.length === 0) {
            return NextResponse.json(
                { error: "Select at least one conversation" },
                { status: 400 }
            );
        }

        if (selectedIds.some((id) => !ObjectId.isValid(id))) {
            return NextResponse.json(
                { error: "Invalid conversation ID" },
                { status: 400 }
            );
        }

        if (user.role !== "admin" && user.role !== "annotator") {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        if (user.role === "annotator") {
            const assignments = await (await getAssignmentCollection())
                .find({
                    databaseId,
                    annotators: user.username
                })
                .toArray();

            const allowedIds = new Set(
                assignments.flatMap((assignment) =>
                    (assignment.conversations || []).map((id: string | ObjectId) =>
                        String(id)
                    )
                )
            );

            const unauthorized = selectedIds.some(
                (id) => !allowedIds.has(id)
            );

            if (unauthorized) {
                return NextResponse.json(
                    { error: "Access denied to one or more conversations" },
                    { status: 403 }
                );
            }
        }

        const conversations = await withConversationCollection(
            databaseId,
            async (collection) => {
                return collection.find({
                    _id: {
                        $in: selectedIds.map((id) => new ObjectId(id))
                    }
                }).toArray();
            }
        );

        if (conversations.length === 0) {
            return NextResponse.json(
                { error: "No conversations found" },
                { status: 404 }
            );
        }

        return new NextResponse(
            JSON.stringify(conversations, null, 2),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": 'attachment; filename="conversations.json"'
                }
            }
        );
    } catch (error) {
        console.error("[Export API]", error);

        return NextResponse.json(
            { error: "Failed to export conversations" },
            { status: 500 }
        );
    }
}