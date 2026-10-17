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

        if (!databaseId || databaseId === "undefined") {
            return NextResponse.json(
                { error: "Database ID is required" },
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

        if (user.role === "annotator") {
            const assignments = await (await getAssignmentCollection())
                .find({
                    databaseId,
                    annotators: user.username,
                    conversations: { $in: selectedIds }
                })
                .toArray();

            const allowedIds = new Set(
                assignments.flatMap((assignment) => assignment.conversations || [])
            );

            if (selectedIds.some((id) => !allowedIds.has(id))) {
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
        return NextResponse.json(
            { error: String(error) },
            { status: 403 }
        );
    }
}