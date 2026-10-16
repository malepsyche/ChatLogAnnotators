import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import {
  getCollection,
  getAssignmentCollection,
  getUserCollection,
} from "@/lib/cosmosdb";

export async function getRequestUser() {
  const username = (await cookies()).get("username")?.value;
  if (!username) {
    console.warn("[getRequestUser] Missing username cookie");
    return null;
  }
  const user = await (await getUserCollection()).findOne({
    username: decodeURIComponent(username),
    isDeleted: { $ne: true },
  });
  if (!user) {
    console.warn("[getRequestUser] User not found:", username);
    return null;
  }
  return user;
}

export async function getAnnotationLockStatus(
  conversationId: string,
  databaseId: string,
  username: string,
  assignmentTitle?: string
) {
  if (!ObjectId.isValid(conversationId)) throw new Error("Invalid conversation ID");
  const conversation = await (await getCollection()).findOne({
    _id: new ObjectId(conversationId),
  });
  if (!conversation) throw new Error("Conversation not found");

  const conversationLocked = conversation.lock?.isLocked === true;

  // Only the specific assignment being worked on should control its annotator.
  // An assignment title is optional for older routes; if omitted, any locked
  // assignment matching this annotator/conversation applies.
  const query: Record<string, unknown> = {
    databaseId,
    conversations: conversationId,
    annotators: username,
    "lock.isLocked": true,
  };
  if (assignmentTitle) query.title = assignmentTitle;

  const assignment = await (await getAssignmentCollection()).findOne(query);
  const assignmentLocked = Boolean(assignment);

  return {
    conversationLocked,
    assignmentLocked,
    isLocked: conversationLocked || assignmentLocked,
  };
}

export async function getWriteAccess(conversationId: string) {
  const user = await getRequestUser();
  if (!user) return { user: null, allowed: false, reason: "Authentication required" };

  if (user.role === "admin") {
    return { user, allowed: true, reason: "" };
  }

  if (user.role !== "annotator" || !user.activeDatabaseId) {
    return { user, allowed: false, reason: "Annotator access required" };
  }

  const status = await getAnnotationLockStatus(
    conversationId,
    user.activeDatabaseId,
    user.username,
    user.activeAssignment
  );

  return {
    user,
    allowed: !status.isLocked,
    reason: status.isLocked ? "Annotations are locked" : "",
  };
}
