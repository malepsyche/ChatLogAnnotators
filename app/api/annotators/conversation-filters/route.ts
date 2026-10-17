import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getAssignmentCollection, getCollection } from "@/lib/cosmosdb";
import { getRequestUser } from "@/lib/annotationLock";
import {
    completion,
    consensus,
    needsReview,
    isAdminResolved,
    aggregateCompletion
} from "@/lib/conversation-filter-status";

export async function GET(req: Request) {
    try {
        const user = await getRequestUser();

        if (!user || user.role !== "annotator") {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        const assignmentId = new URL(req.url).searchParams.get("assignmentId");

        if (!assignmentId || !ObjectId.isValid(assignmentId)) {
            return NextResponse.json(
                { error: "Invalid assignment ID" },
                { status: 400 }
            );
        }

        const assignment = await (await getAssignmentCollection()).findOne({
            _id: new ObjectId(assignmentId),
            annotators: user.username
        });

        if (!assignment) {
            return NextResponse.json(
                { error: "Assignment not found" },
                { status: 404 }
            );
        }

        const ids = (assignment.conversations || [])
            .filter((id: string) => ObjectId.isValid(id))
            .map((id: string) => new ObjectId(id));

        const collection = await getCollection();

        const documents = await collection.find(
            {
                _id: { $in: ids }
            },
            {
                projection: {
                    title: 1,
                    person: 1,
                    Person: 1,
                    stime: 1,
                    last_interact: 1,
                    annotations: 1,
                    "messages.annotations": 1,
                    lock: 1
                }
            }
        ).toArray();

        const annotators: string[] = assignment.annotators || [];

        const conversations = documents.map((doc) => {
            const status = aggregateCompletion(doc, annotators);
            const agreement = consensus(doc, annotators);

            return {
                _id: doc._id.toString(),
                title: doc.title || "Untitled",
                person: doc.person || doc.Person || "Unknown",
                firstInteraction: doc.stime?.text || "",
                lastInteraction: doc.last_interact?.text || "",
                assignmentId: assignment._id.toString(),
                annotators,
                completion: status,
                consensus: agreement,
                needsReview: needsReview(doc, annotators),
                adminResolved: isAdminResolved(doc),
                locked:
                    doc.lock?.isLocked === true ||
                    assignment.lock?.isLocked === true,
                perAnnotatorCompletion: Object.fromEntries(
                    annotators.map((name) => [
                        name,
                        completion(doc, name)
                    ])
                )
            };
        });

        return NextResponse.json({
            assignments: [{
                _id: assignment._id.toString(),
                title: assignment.title,
                annotators
            }],
            conversations
        });
    } catch (error) {
        console.error("[Annotator Filters]", error);

        return NextResponse.json(
            { error: "Failed to fetch annotator conversation filters" },
            { status: 500 }
        );
    }
}