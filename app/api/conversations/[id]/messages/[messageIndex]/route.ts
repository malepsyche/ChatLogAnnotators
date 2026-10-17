import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/cosmosdb";
import { getWriteAccess } from "@/lib/annotationLock";

type Context = { params: Promise<{ id: string; messageIndex: string }> };
type Item = Record<string, unknown>;

async function parseContext(context: Context) {
  const { id, messageIndex } = await context.params;
  const index = Number(messageIndex);

  if (!ObjectId.isValid(id) || !Number.isSafeInteger(index) || index < 0) {
    return null;
  }

  return { id, index };
}

export async function POST(req: Request, context: Context) {
  try {
    const params = await parseContext(context);

    if (!params) {
      return NextResponse.json({ error: "Invalid route" }, { status: 400 });
    }

    const body = await req.json();

    if (body.id && body.id !== params.id) {
      return NextResponse.json({ error: "ID mismatch" }, { status: 400 });
    }

    if (
      typeof body.comment?.content !== "string" ||
      !body.comment.content.trim()
    ) {
      return NextResponse.json({ error: "Comment content required" }, { status: 400 });
    }

    const access = await getWriteAccess(params.id, body.assignmentId);

    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const filter: Item = {
      _id: new ObjectId(params.id),
      [`messages.${params.index}`]: { $exists: true },
    };

    if (access.user?.role === "annotator") {
      filter["lock.isLocked"] = { $ne: true };
    }

    const result = await (await getCollection()).updateOne(filter, {
      $push: {
        [`messages.${params.index}.comments`]: {
          _id: new ObjectId(),
          name: access.user!.username,
          timestamp: Date.now(),
          content: body.comment.content.trim(),
        },
      } as any,
    });

    if (!result.matchedCount) {
      return NextResponse.json(
        { error: "Message missing or conversation locked" },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "Comment added successfully" });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: Context) {
  try {
    const params = await parseContext(context);

    if (!params) {
      return NextResponse.json({ error: "Invalid route" }, { status: 400 });
    }

    const body = await req.json();

    if (body.id && body.id !== params.id) {
      return NextResponse.json({ error: "ID mismatch" }, { status: 400 });
    }

    if (!ObjectId.isValid(body.commentId)) {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const access = await getWriteAccess(params.id, body.assignmentId);

    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const filter: Item = {
      _id: new ObjectId(params.id),
    };

    if (access.user?.role === "annotator") {
      filter["lock.isLocked"] = { $ne: true };
    }

    const commentFilter: Item = {
      _id: new ObjectId(body.commentId),
    };

    if (access.user?.role !== "admin") {
      commentFilter.name = access.user!.username;
    }

    const result = await (await getCollection()).updateOne(filter, {
      $pull: {
        [`messages.${params.index}.comments`]: commentFilter,
      } as any,
    });

    if (!result.modifiedCount) {
      return NextResponse.json(
        { error: "Comment missing, not owned, or locked" },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Context) {
  try {
    const params = await parseContext(context);

    if (!params) {
      return NextResponse.json({ error: "Invalid route" }, { status: 400 });
    }

    const body = await req.json();

    if (body.id && body.id !== params.id) {
      return NextResponse.json({ error: "ID mismatch" }, { status: 400 });
    }

    if (
      body.messageIndex !== undefined &&
      Number(body.messageIndex) !== params.index
    ) {
      return NextResponse.json({ error: "Message index mismatch" }, { status: 400 });
    }

    if (
      !ObjectId.isValid(body.annotationId) ||
      !Array.isArray(body.updatedAnswer) ||
      !body.updatedAnswer.every((v: unknown) => typeof v === "string")
    ) {
      return NextResponse.json({ error: "Invalid annotation update" }, { status: 400 });
    }

    const access = await getWriteAccess(params.id, body.assignmentId);

    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const collection = await getCollection();

    const conversation = await collection.findOne({
      _id: new ObjectId(params.id),
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const message = conversation.messages?.[params.index];

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const annotations = message.annotations ?? [];

    const annotationIndex = annotations.findIndex(
      (annotation: Item) =>
        String(annotation._id) === body.annotationId
    );

    if (annotationIndex < 0) {
      return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
    }

    const answers = annotations[annotationIndex].answers ?? [];

    const answerIndex = answers.findIndex(
      (answer: Item) =>
        answer &&
        typeof answer === "object" &&
        answer.name === access.user!.username
    );

    const prefix = `messages.${params.index}.annotations.${annotationIndex}`;

    const filter: Item = {
      _id: new ObjectId(params.id),
      [`${prefix}._id`]: new ObjectId(body.annotationId),
    };

    if (access.user?.role === "annotator") {
      filter["lock.isLocked"] = { $ne: true };
    }

    const content = [...new Set<string>(body.updatedAnswer)];

    const result =
      answerIndex >= 0
        ? await collection.updateOne(filter, {
            $set: {
              [`${prefix}.answers.${answerIndex}.content`]: content,
              [`${prefix}.answers.${answerIndex}.timestamp`]: Date.now(),
            },
          })
        : await collection.updateOne(filter, {
            $push: {
              [`${prefix}.answers`]: {
                _id: new ObjectId(),
                name: access.user!.username,
                timestamp: Date.now(),
                content,
              },
            } as any,
          });

    if (!result.matchedCount) {
      return NextResponse.json(
        { error: "Conversation locked or annotation changed" },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "Answer updated successfully" });
  } catch (error) {
    console.error("Error updating message annotation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}