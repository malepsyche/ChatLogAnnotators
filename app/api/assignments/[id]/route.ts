import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
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

    return NextResponse.json({
      _id: assignment._id.toString(),
      title: assignment.title,
      databaseId: assignment.databaseId,
      conversations: assignment.conversations || [],
      annotators: assignment.annotators || [],
      lock: assignment.lock || {
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching assignment:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}