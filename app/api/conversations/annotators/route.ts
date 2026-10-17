import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
    getCollection,
    getAssignmentCollection,
    getDatabaseCollection,
} from "@/lib/cosmosdb";
import { getRequestUser } from "@/lib/annotationLock";
import { switchDatabase } from "@/lib/databaseManager";

export async function GET(req: Request) {
    console.log("[GET] 1. Request started");

    try {
        const url = new URL(req.url);
        const assignmentId = url.searchParams.get("assignmentId");
        const searchQuery = url.searchParams.get("query") || "";

        if (!assignmentId || !ObjectId.isValid(assignmentId)) {
            return NextResponse.json(
                { error: "Invalid assignment ID" },
                { status: 400 }
            );
        }

        console.log("[GET] 2. Before getRequestUser()");
        const user = await getRequestUser();
        console.log("[GET] 3. After getRequestUser()");

        if (!user || user.role !== "annotator") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 403 }
            );
        }

        console.log("[GET] 4. Before getAssignmentCollection()");
        const assignmentCollection = await getAssignmentCollection();
        console.log("[GET] 5. After getAssignmentCollection()");

        console.log("[GET] 6. Before assignment.findOne()");
        const assignment = await assignmentCollection.findOne({
            _id: new ObjectId(assignmentId),
            annotators: user.username,
        });
        console.log("[GET] 7. After assignment.findOne()");

        if (!assignment) {
            return NextResponse.json(
                { error: "Assignment not found or access denied" },
                { status: 404 }
            );
        }

        console.log("[GET] 8. Before getDatabaseCollection()");
        const databaseCollection = await getDatabaseCollection();
        console.log("[GET] 9. After getDatabaseCollection()");

        console.log("[GET] 10. Before database.findOne()");
        const database = await databaseCollection.findOne({
            _id: new ObjectId(assignment.databaseId),
        });
        console.log("[GET] 11. After database.findOne()");

        if (!database) {
            return NextResponse.json(
                { error: "Database not found" },
                { status: 404 }
            );
        }

        console.log("[GET] 12. Before switchDatabase()");
        switchDatabase({
            uri: database.uri,
            databaseId: database.databaseId.toString(),
            containerId: database.containerId,
            name: database.name,
        });
        console.log("[GET] 13. After switchDatabase()");

        console.log("[GET] 14. Before getCollection()");
        const collection = await getCollection();
        console.log("[GET] 15. After getCollection()");

        const conversationIds = (assignment.conversations || [])
            .filter((id: string) => ObjectId.isValid(id))
            .map((id: string) => new ObjectId(id));

        if (conversationIds.length === 0) {
            return NextResponse.json([]);
        }

        const escapedQuery = searchQuery.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        const filter = {
            _id: {
                $in: conversationIds,
            },
            ...(searchQuery
                ? {
                    $or: [
                        { person: { $regex: escapedQuery, $options: "i" } },
                        { Person: { $regex: escapedQuery, $options: "i" } },
                        {
                            "messages.content": {
                                $regex: escapedQuery,
                                $options: "i",
                            },
                        },
                    ],
                }
                : {}),
        };

        console.log("[GET] 16. Before conversations.find().toArray()");
        const conversationsArray = await collection.find(filter).toArray();
        console.log("[GET] 17. After conversations.find().toArray()");

        const conversations = conversationsArray.map((doc) => ({
            _id: doc._id.toString(),
            title: doc.title || "Untitled",
            person: doc.person || doc.Person || "Unknown",
            Person: doc.person || doc.Person || "Unknown",
            firstInteraction: doc.stime?.text || "No start time",
            lastInteraction: doc.last_interact?.text || "No last interaction",
            messages: doc.messages || [],
            annotations: doc.annotations || [],
            lock: doc.lock || {
                isLocked: false,
                lockedBy: null,
                lockedAt: null,
            },
            effectiveLock: {
                conversationLocked: doc.lock?.isLocked === true,
                assignmentLocked: assignment.lock?.isLocked === true,
                isLocked:
                    doc.lock?.isLocked === true ||
                    assignment.lock?.isLocked === true,
            },
        }));

        console.log("[GET] 18. Returning conversations:", conversations.length);

        return NextResponse.json(conversations);
    } catch (error) {
        console.error("[API] Error fetching annotator conversations:", error);

        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}