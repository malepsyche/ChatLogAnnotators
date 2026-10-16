import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getAssignmentCollection } from "@/lib/cosmosdb";
import { getRequestUser } from "@/lib/annotationLock";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { isLocked } = await req.json();
    if (!ObjectId.isValid(id) || typeof isLocked !== "boolean") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const user = await getRequestUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const result = await (await getAssignmentCollection()).updateOne(
      { _id: new ObjectId(id) },
      { $set: { lock: {
        isLocked,
        lockedBy: isLocked ? user.username : null,
        lockedAt: isLocked ? Date.now() : null,
      } } }
    );
    if (!result.matchedCount) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    return NextResponse.json({ message: isLocked ? "Assignment locked" : "Assignment unlocked" });
  } catch (error) {
    console.error("Error updating assignment lock:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
