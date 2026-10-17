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
  assignmentId: string
) {
  if (!ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  if (!ObjectId.isValid(assignmentId)) {
    throw new Error("Invalid assignment ID");
  }

  const assignmentCollection = await getAssignmentCollection();

  const assignment = await assignmentCollection.findOne({
    _id: new ObjectId(assignmentId),
    databaseId,
    annotators: username,
    conversations: conversationId,
  });

  if (!assignment) {
    return {
      conversationLocked: false,
      assignmentLocked: false,
      isLocked: true,
      accessDenied: true,
    };
  }

  const collection = await getCollection();

  const conversation = await collection.findOne({
    _id: new ObjectId(conversationId),
  });

  if (!conversation) {
    return {
      conversationLocked: false,
      assignmentLocked: false,
      isLocked: true,
      accessDenied: true,
    };
  }

  const conversationLocked = conversation.lock?.isLocked === true;
  const assignmentLocked = assignment.lock?.isLocked === true;

  return {
    conversationLocked,
    assignmentLocked,
    isLocked: conversationLocked || assignmentLocked,
    accessDenied: false,
  };
}

export async function getWriteAccess(
  conversationId: string,
  assignmentId?: string
) {
  const user = await getRequestUser();

  if (!user) {
    return {
      user: null,
      allowed: false,
      reason: "Authentication required",
    };
  }

  if (user.role === "admin") {
    return {
      user,
      allowed: true,
      reason: "",
    };
  }

  if (user.role !== "annotator") {
    return {
      user,
      allowed: false,
      reason: "Access denied",
    };
  }

  if (!assignmentId || !ObjectId.isValid(assignmentId)) {
    return {
      user,
      allowed: false,
      reason: "Valid assignment ID required",
    };
  }

  const assignment = await (await getAssignmentCollection()).findOne({
    _id: new ObjectId(assignmentId),
    annotators: user.username,
    conversations: conversationId,
  });

  if (!assignment) {
    return {
      user,
      allowed: false,
      reason: "Conversation is not assigned to this annotator",
    };
  }

  const status = await getAnnotationLockStatus(
    conversationId,
    assignment.databaseId,
    user.username,
    assignmentId
  );

  return {
    user,
    allowed: !status.isLocked && !status.accessDenied,
    reason: status.accessDenied
      ? "Conversation is not assigned to this annotator"
      : status.isLocked
      ? "Annotations are locked"
      : "",
  };
}