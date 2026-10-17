import { NextResponse } from "next/server";
import { getAssignmentCollection, getCollection, getDatabaseCollection } from "@/lib/cosmosdb";
import { getRequestUser } from "@/lib/annotationLock";
import { aggregateCompletion, completion, consensus, needsReview, isAdminResolved } from "@/lib/conversation-filter-status";

export async function GET(req: Request) {
    try {
        const user = await getRequestUser();
        if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const name = new URL(req.url).searchParams.get("name");
        if (!name) return NextResponse.json({ error: "Missing database name" }, { status: 400 });
        const database = await (await getDatabaseCollection()).findOne({ name });
        if (!database) return NextResponse.json({ error: "Database not found" }, { status: 404 });
        const assignments = await (await getAssignmentCollection()).find({ databaseId: database._id.toString() }).toArray();
        const mapping = new Map<string, typeof assignments[number]>();
        for (const assignment of assignments) for (const id of assignment.conversations || []) if (!mapping.has(String(id))) mapping.set(String(id), assignment);
        // Uses the application's existing active-database connection, as requested.
        const collection = await getCollection();
        const documents = await collection.find({}, { projection: { title: 1, person: 1, Person: 1, stime: 1, last_interact: 1, annotations: 1, "messages.annotations": 1, lock: 1 } }).toArray();
        const conversations = documents.map((doc) => {
            const assignment = mapping.get(doc._id.toString());
            const annotators: string[] = assignment?.annotators || [];
            const status = aggregateCompletion(doc, annotators);
            const agreement = consensus(doc, annotators);
            return {
                _id: doc._id.toString(), title: doc.title || "Untitled", person: doc.person || doc.Person || "Unknown",
                firstInteraction: doc.stime?.text || "", lastInteraction: doc.last_interact?.text || "",
                assignmentId: assignment?._id.toString() || null, annotators,
                completion: status, consensus: agreement, needsReview: needsReview(doc, annotators),
                adminResolved: isAdminResolved(doc), locked: doc.lock?.isLocked === true || assignment?.lock?.isLocked === true,
                perAnnotatorCompletion: Object.fromEntries(annotators.map((name) => [name, completion(doc, name)])),
            };
        });
        return NextResponse.json({ assignments: assignments.map((assignment) => ({ _id: assignment._id.toString(), title: assignment.title, annotators: assignment.annotators || [] })), conversations });
    } catch (error) {
        console.error("[Admin Filters]", error);
        return NextResponse.json({ error: "Failed to fetch admin conversation filters" }, { status: 500 });
    }
}
