import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  getCollection,
  getUserCollection,
  getAssignmentCollection,
} from "@/lib/cosmosdb";
import {
  getAnnotationLockStatus,
  getRequestUser,
  getWriteAccess,
} from "@/lib/annotationLock";

type Context = { params: Promise<{ id: string }> };
type RecordValue = Record<string, unknown>;

function validAnswer(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function latestUserAnswers(answers: unknown[], usernames: string[]) {
  const latest = new Map<string, RecordValue>();

  for (const raw of answers) {
    if (!raw || typeof raw !== "object") continue;

    const answer = raw as RecordValue;

    if (typeof answer.name !== "string" || !usernames.includes(answer.name)) {
      continue;
    }

    const previous = latest.get(answer.name);

    if (
      !previous ||
      Number(answer.timestamp || 0) >= Number(previous.timestamp || 0)
    ) {
      latest.set(answer.name, answer);
    }
  }

  return latest;
}

export async function GET(req: Request, context: Context) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
    }

    const requestUser = await getRequestUser();

    if (!requestUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const url = new URL(req.url);
    const assignmentId = url.searchParams.get("assignmentId");

    let effectiveLock = {
      conversationLocked: false,
      assignmentLocked: false,
      isLocked: false,
    };

    if (requestUser.role === "annotator") {
      if (!assignmentId || !ObjectId.isValid(assignmentId)) {
        return NextResponse.json({ error: "Assignment ID required" }, { status: 400 });
      }

      const assignment = await (await getAssignmentCollection()).findOne({
        _id: new ObjectId(assignmentId),
        annotators: requestUser.username,
        conversations: id,
      });

      if (!assignment) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const status = await getAnnotationLockStatus(
        id,
        assignment.databaseId,
        requestUser.username,
        assignmentId
      );

      if (status.accessDenied) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      effectiveLock = {
        conversationLocked: status.conversationLocked,
        assignmentLocked: status.assignmentLocked,
        isLocked: status.isLocked,
      };
    } else if (requestUser.role !== "admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const collection = await getCollection();

    const conversation = await collection.findOne({
      _id: new ObjectId(id),
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (requestUser.role === "admin") {
      effectiveLock = {
        conversationLocked: conversation.lock?.isLocked === true,
        assignmentLocked: false,
        isLocked: conversation.lock?.isLocked === true,
      };
    }

    const assignmentDocs = await (await getAssignmentCollection())
      .find({ conversations: id })
      .toArray();

    const assignedUsernames = [
      ...new Set(
        assignmentDocs.flatMap((assignment) =>
          Array.isArray(assignment.annotators)
            ? assignment.annotators
            : []
        )
      ),
    ];

    const users = await (await getUserCollection())
      .find({
        username: { $in: assignedUsernames },
        role: "annotator",
        isDeleted: { $ne: true },
      })
      .toArray();

    const usernames = users.map((user) => user.username);

    const allAnnotations = [
      ...(conversation.annotations ?? []),
      ...(conversation.messages ?? []).flatMap((message: RecordValue) =>
        Array.isArray(message.annotations) ? message.annotations : []
      ),
    ];

    const annotationStats = {
      annotated: 0,
      inProgress: 0,
      notAnnotated: 0,
      totalAssigned: users.length,
      annotatedUsers: [] as string[],
      inProgressUsers: [] as string[],
      notAnnotatedUsers: [] as string[],
    };

    for (const user of users) {
      const answeredCount = allAnnotations.filter((annotation: RecordValue) =>
        Array.isArray(annotation.answers) &&
        annotation.answers.some((answer: RecordValue) =>
          answer &&
          typeof answer === "object" &&
          answer.name === user.username &&
          Array.isArray(answer.content)
        )
      ).length;

      if (answeredCount === 0) {
        annotationStats.notAnnotated++;
        annotationStats.notAnnotatedUsers.push(user.username);
      } else if (answeredCount === allAnnotations.length) {
        annotationStats.annotated++;
        annotationStats.annotatedUsers.push(user.username);
      } else {
        annotationStats.inProgress++;
        annotationStats.inProgressUsers.push(user.username);
      }
    }

    const annotations = (conversation.annotations ?? []).map(
      (annotation: RecordValue) => {
        const adminResolution = annotation.adminResolution as
          | { content: string[] }
          | undefined;

        if (adminResolution) {
          return {
            ...annotation,
            resolutionStatus: "admin-resolved",
            effectiveFinalAnnotation: adminResolution.content,
          };
        }

        const latest = latestUserAnswers(
          Array.isArray(annotation.answers) ? annotation.answers : [],
          usernames
        );

        if (usernames.length === 0 || latest.size !== usernames.length) {
          return {
            ...annotation,
            resolutionStatus: "pending",
            effectiveFinalAnnotation: null,
          };
        }

        const answers = [...latest.values()];

        const normalize = (value: unknown) =>
          Array.isArray(value)
            ? [...value]
                .filter((v): v is string => typeof v === "string")
                .sort()
            : [];

        const first = normalize(answers[0].content);

        const consensus = answers.every((answer) => {
          const current = normalize(answer.content);

          return (
            current.length === first.length &&
            current.every((value, index) => value === first[index])
          );
        });

        return {
          ...annotation,
          resolutionStatus: consensus ? "consensus" : "disagreement",
          effectiveFinalAnnotation: consensus ? first : null,
        };
      }
    );

    return NextResponse.json({
      ...conversation,
      annotations,
      annotationStats,
      effectiveLock,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const {
      annotationId,
      updatedAnswer,
      assignmentId,
      action = "annotate",
    } = body;

    if (
      !ObjectId.isValid(id) ||
      !ObjectId.isValid(annotationId) ||
      !validAnswer(updatedAnswer) ||
      !["annotate", "resolve"].includes(action)
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (body.id && body.id !== id) {
      return NextResponse.json({ error: "Conversation ID mismatch" }, { status: 400 });
    }

    const user = await getRequestUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (action === "resolve" && user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (action === "annotate") {
      const access = await getWriteAccess(id, assignmentId);

      if (!access.allowed) {
        return NextResponse.json({ error: access.reason }, { status: 403 });
      }
    }

    const collection = await getCollection();

    const conversation = await collection.findOne({
      _id: new ObjectId(id),
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const index = (conversation.annotations ?? []).findIndex(
      (annotation: RecordValue) =>
        String(annotation._id) === annotationId
    );

    if (index === -1) {
      return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
    }

    const content = [...new Set(updatedAnswer)];
    const annotation = conversation.annotations[index] as RecordValue;
    const answers = Array.isArray(annotation.answers)
      ? annotation.answers
      : [];

    const filter: RecordValue = {
      _id: new ObjectId(id),
      [`annotations.${index}._id`]: new ObjectId(annotationId),
    };

    if (user.role === "annotator") {
      filter["lock.isLocked"] = { $ne: true };
    }

    let result;

    if (action === "resolve") {
      result = await collection.updateOne(filter, {
        $set: {
          [`annotations.${index}.adminResolution`]: {
            content,
            name: user.username,
            timestamp: Date.now(),
          },
        },
      });
    } else {
      const existing = answers.findIndex(
        (answer: RecordValue) =>
          answer &&
          typeof answer === "object" &&
          answer.name === user.username
      );

      if (existing !== -1) {
        result = await collection.updateOne(filter, {
          $set: {
            [`annotations.${index}.answers.${existing}.content`]: content,
            [`annotations.${index}.answers.${existing}.timestamp`]: Date.now(),
          },
        });
      } else {
        result = await collection.updateOne(filter, {
          $push: {
            [`annotations.${index}.answers`]: {
              _id: new ObjectId(),
              name: user.username,
              timestamp: Date.now(),
              content,
            },
          } as any,
        });
      }
    }

    if (!result.matchedCount) {
      return NextResponse.json(
        { error: "Conversation locked or annotation changed; refresh and retry" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message:
        action === "resolve"
          ? "Annotation resolved successfully"
          : "Annotation updated successfully",
    });
  } catch (error) {
    console.error("Error updating annotation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}