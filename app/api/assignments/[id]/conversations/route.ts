import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  getCollection,
  getUserCollection,
  getAssignmentCollection,
} from "@/lib/cosmosdb";

export async function GET(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ assignmentId: string }>;
  }
) {
  try {
    const { assignmentId } = await params;

    const url = new URL(req.url);
    const username = url.searchParams.get("username");
    const searchQuery = url.searchParams.get("query") || "";

    if (!username) {
      return NextResponse.json(
        { error: "Missing username" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(assignmentId)) {
      return NextResponse.json(
        { error: "Invalid assignment ID" },
        { status: 400 }
      );
    }

    const userCollection = await getUserCollection();

    const user = await userCollection.findOne({ username });

    if (!user || user.role !== "annotator") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const assignmentCollection = await getAssignmentCollection();

    const assignment = await assignmentCollection.findOne({
      _id: new ObjectId(assignmentId),
      annotators: username,
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found or access denied" },
        { status: 404 }
      );
    }

    const conversationIds = (assignment.conversations || [])
      .filter((id: string) => ObjectId.isValid(id))
      .map((id: string) => new ObjectId(id));

    if (conversationIds.length === 0) {
      return NextResponse.json([]);
    }

    const collection = await getCollection();

    const filter = {
      _id: {
        $in: conversationIds,
      },
      ...(searchQuery
        ? {
            $or: [
              { person: { $regex: searchQuery, $options: "i" } },
              { Person: { $regex: searchQuery, $options: "i" } },
              { "stime.text": { $regex: searchQuery, $options: "i" } },
              { "last_interact.text": { $regex: searchQuery, $options: "i" } },
              { "messages.content": { $regex: searchQuery, $options: "i" } },
            ],
          }
        : {}),
    };

    const documents = await collection
      .find(filter, {
        projection: {
          title: 1,
          person: 1,
          Person: 1,
          stime: 1,
          last_interact: 1,
          messages: 1,
          annotations: 1,
          lock: 1,
        },
      })
      .toArray();

    const conversations = documents.map((doc) => ({
      _id: doc._id.toString(),
      title: doc.title || "Untitled",
      Person: (doc.person || doc.Person) ?? "Unknown",
      firstInteraction: doc.stime?.text || "No start time",
      lastInteraction: doc.last_interact?.text || "No last interaction",
      messages: doc.messages || [],
      annotations: doc.annotations || [],
      lock: doc.lock || {
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
      },
      assignmentId: assignment._id.toString(),
      assignmentLocked: assignment.lock?.isLocked || false,
      effectiveLock: {
        isLocked:
          (doc.lock?.isLocked || false) ||
          (assignment.lock?.isLocked || false),
        conversationLocked: doc.lock?.isLocked || false,
        assignmentLocked: assignment.lock?.isLocked || false,
      },
    }));

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("[API] Error fetching assignment conversations:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}