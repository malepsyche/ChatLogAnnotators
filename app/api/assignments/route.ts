import { NextResponse } from "next/server";
import { getUserCollection } from "@/lib/cosmosdb";
import { getAssignmentCollection } from "@/lib/cosmosdb";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const username = url.searchParams.get("username");
    const databaseId = url.searchParams.get("databaseId");

    if (!username) {
      return NextResponse.json(
        { error: "Missing username" },
        { status: 400 }
      );
    }

    const userCollection = await getUserCollection();

    const user = await userCollection.findOne({ username });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.role !== "annotator") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const assignmentCollection = await getAssignmentCollection();

    const filter = {
      annotators: username,
      ...(databaseId ? { databaseId } : {}),
    };

    const assignments = await assignmentCollection
      .find(filter)
      .sort({ title: 1 })
      .toArray();

    const assignmentsList = assignments.map((assignment) => ({
      _id: assignment._id.toString(),
      assignmentId: assignment._id.toString(),
      assignmentTitle: assignment.title,
      databaseId: assignment.databaseId,
      conversationCount: assignment.conversations?.length || 0,
      isLocked: assignment.lock?.isLocked || false,
    }));

    return NextResponse.json(assignmentsList);
  } catch (error) {
    console.error("[API] Error fetching assignments:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}