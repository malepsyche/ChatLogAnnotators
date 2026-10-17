import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  getAssignmentCollection,
  getDatabaseCollection,
} from "@/lib/cosmosdb";
import { getRequestUser } from "@/lib/annotationLock";
import { switchDatabase } from "@/lib/databaseManager";

export async function POST(req: Request) {
  try {
    const { assignmentId } = await req.json();

    if (!assignmentId || !ObjectId.isValid(assignmentId)) {
      return NextResponse.json({ error: "Invalid assignment ID" }, { status: 400 });
    }

    console.log("[Switch] 1. Authenticating user");
    const user = await getRequestUser();
    console.log("[Switch] 2. User authenticated");

    if (!user || user.role !== "annotator") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    console.log("[Switch] 3. Fetching assignment");
    const assignmentCollection = await getAssignmentCollection();

    const assignment = await assignmentCollection.findOne({
      _id: new ObjectId(assignmentId),
      annotators: user.username,
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found or access denied" },
        { status: 404 }
      );
    }

    if (!ObjectId.isValid(assignment.databaseId)) {
      return NextResponse.json({ error: "Invalid database ID" }, { status: 400 });
    }

    console.log("[Switch] 4. Assignment fetched");
    console.log("[Switch] 5. Fetching database configuration");
    const databaseCollection = await getDatabaseCollection();

    const database = await databaseCollection.findOne({
      _id: new ObjectId(assignment.databaseId),
    });

    if (!database) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    console.log("[Switch] 6. Database configuration fetched");
    console.log("[Switch] 7. Switching database");
    switchDatabase({
      uri: database.uri,
      databaseId: database.databaseId.toString(),
      containerId: database.containerId,
      name: database.name,
    });

    console.log("[Switch] 8. Database switched");
    return NextResponse.json({
      assignmentId: assignment._id.toString(),
      assignmentTitle: assignment.title,
      databaseId: assignment.databaseId,
      isLocked: assignment.lock?.isLocked === true,
    });
  } catch (error) {
    console.error("[API] Error switching assignment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}