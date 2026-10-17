import { NextResponse } from "next/server";
import { getUserCollection, getAssignmentCollection } from "@/lib/cosmosdb";
import { getRequestUser } from "@/lib/annotationLock";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const username = url.searchParams.get("username");

    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    const requestUser = await getRequestUser();

    if (!requestUser || requestUser.username !== username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const userCollection = await getUserCollection();
    const user = await userCollection.findOne({
      username,
      isDeleted: { $ne: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role !== "annotator") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const assignmentCollection = await getAssignmentCollection();

    const assignments = await assignmentCollection
      .find({ annotators: username })
      .sort({ title: 1 })
      .toArray();

    const assignmentsList = assignments.map((assignment) => ({
      assignmentId: assignment._id.toString(),
      assignmentTitle: assignment.title,
      databaseId: assignment.databaseId,
      conversationCount: assignment.conversations?.length || 0,
      isLocked: assignment.lock?.isLocked === true,
    }));

    return NextResponse.json(assignmentsList);
  } catch (error) {
    console.error("[API] Error fetching assignments:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}