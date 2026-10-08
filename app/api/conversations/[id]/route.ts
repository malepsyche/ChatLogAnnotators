// this API is for fetching each conversation and the patch is for annotating the conversation.

import { NextResponse } from "next/server";
import { getCollection, getUserCollection } from "@/lib/cosmosdb";
import { ObjectId } from "mongodb";

export async function GET(req: Request, context: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
  try {
    const params = await context.params;
    const { id } = params;

    const collection = await getCollection();
    const userCollection = await getUserCollection();
    const conversation = await collection.findOne({ _id: new ObjectId(id) });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const users = await userCollection
      .find({
        role: "annotator",
        isDeleted: false,
      })
      .toArray();

    const assignedUsers = users.filter((user) => {
      if (!user.assignedConversations) {
        return false;
      }

      return Object.values(user.assignedConversations).some(
        (database: any) =>
          database.assignments?.some((assignment: any) =>
            assignment.conversations?.includes(id)
          )
      );
    });

    const allAnnotations = [
      ...(conversation.annotations ?? []),
      ...(conversation.messages ?? []).flatMap(
        (message: any) => message.annotations ?? []
      ),
    ];

    let annotated = 0;
    let inProgress = 0;
    let notAnnotated = 0;

    const annotatedUsers: string[] = [];
    const inProgressUsers: string[] = [];
    const notAnnotatedUsers: string[] = [];
    
    for (const user of assignedUsers) {
      const answeredCount = allAnnotations.filter(
        (annotation: any) =>
          annotation.answers?.some(
            (answer: any) =>
              typeof answer === "object" &&
              answer !== null &&
              answer.name === user.username
          )
      ).length;

      if (answeredCount === 0) {
        notAnnotated++;
        notAnnotatedUsers.push(user.username);
      } else if (
        allAnnotations.length > 0 &&
        answeredCount === allAnnotations.length
      ) {
        annotated++;
        annotatedUsers.push(user.username);
      } else {
        inProgress++;
        inProgressUsers.push(user.username);
      }
    }

    const annotationStats = {
      annotated,
      inProgress,
      notAnnotated,
      totalAssigned: assignedUsers.length,

      annotatedUsers,
      inProgressUsers,
      notAnnotatedUsers,
    };

    // Calculate final annotation status for each conversation-level annotation
    const assignedUsernames = assignedUsers.map((user) => user.username);

    const annotationsWithResolution = (conversation.annotations ?? []).map(
      (annotation: any) => {
        // If an admin has manually resolved the annotation,
        // the persisted admin resolution becomes the final annotation.
        if (annotation.adminResolution) {
          return {
            ...annotation,
            resolutionStatus: "admin-resolved",
            effectiveFinalAnnotation: annotation.adminResolution.content,
          };
        }

        // Only use answers from annotators assigned to this conversation.
        const annotatorAnswers = (annotation.answers ?? []).filter(
          (answer: any) =>
            typeof answer === "object" &&
            answer !== null &&
            assignedUsernames.includes(answer.name)
        );

        // No assigned annotators means there cannot be a consensus yet.
        if (assignedUsers.length === 0) {
          return {
            ...annotation,
            resolutionStatus: "pending",
            effectiveFinalAnnotation: null,
          };
        }

        // Check whether every assigned annotator has answered.
        const answeredUsers = new Set(
          annotatorAnswers.map((answer: any) => answer.name)
        );

        if (answeredUsers.size < assignedUsers.length) {
          return {
            ...annotation,
            resolutionStatus: "pending",
            effectiveFinalAnnotation: null,
          };
        }

        // Normalise the answers so multiple-answer selections
        // are considered equal regardless of order.
        const normaliseContent = (content: string[] | null | undefined) =>
          [...(content ?? [])].sort();

        const firstAnswer = normaliseContent(
          annotatorAnswers[0]?.content
        );

        const everyoneAgrees = annotatorAnswers.every((answer: any) => {
          const currentAnswer = normaliseContent(answer.content);

          return (
            currentAnswer.length === firstAnswer.length &&
            currentAnswer.every(
              (value: string, index: number) =>
                value === firstAnswer[index]
            )
          );
        });

        if (everyoneAgrees) {
          return {
            ...annotation,
            resolutionStatus: "consensus",
            effectiveFinalAnnotation: firstAnswer,
          };
        }

        return {
          ...annotation,
          resolutionStatus: "disagreement",
          effectiveFinalAnnotation: null,
        };
      }
    );

    return NextResponse.json({
      ...conversation,
      annotations: annotationsWithResolution,
      annotationStats,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Annotator response update
export async function PATCH(req: Request) {
  try {
    const {
      id,
      annotationId,
      updatedAnswer,
      name,
      action = "annotate",
    } = await req.json();

    if (!id || !annotationId || !updatedAnswer || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!ObjectId.isValid(id) || !ObjectId.isValid(annotationId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const collection = await getCollection();
    const conversation = await collection.findOne({ _id: new ObjectId(id) });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Find the annotation by ID
    const annotationIndex = conversation.annotations.findIndex(
      (annotation: any) => annotation._id.equals(new ObjectId(annotationId)) // eslint-disable-line @typescript-eslint/no-explicit-any
    );

    if (annotationIndex === -1) {
      return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
    }

    // Admin resolution update
    if (action === "resolve") {
      const adminResolution = {
        content: Array.from(new Set(updatedAnswer)),
        name,
        timestamp: Date.now(),
      };

      await collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            [`annotations.${annotationIndex}.adminResolution`]: adminResolution,
          },
        }
      );

      return NextResponse.json({
        message: "Annotation resolved successfully",
      });
    }

    const annotation = conversation.annotations[annotationIndex];

    // Ensure the answers array exists
    if (!Array.isArray(annotation.answers)) {
      annotation.answers = [];
    }

    // Check if an answer from the user already exists
    const existingAnswerIndex = annotation.answers.findIndex(
      (answer: any) => answer.name === name // eslint-disable-line @typescript-eslint/no-explicit-any
    );

    if (existingAnswerIndex !== -1) {
      // Update the existing answer
      const updatePath = `annotations.${annotationIndex}.answers.${existingAnswerIndex}.content`;
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { [updatePath]: Array.from(new Set(updatedAnswer)) } } // Use Set to avoid duplicate answers
      );
    } else {
      // Add a new answer
      const newAnswer = {
        _id: new ObjectId(),
        name,
        timestamp: Date.now(),
        content: Array.from(new Set(updatedAnswer)), // Avoid duplicate answers
      };

      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $push: { [`annotations.${annotationIndex}.answers`]: newAnswer } as any } // eslint-disable-line @typescript-eslint/no-explicit-any 
      );
    }

    return NextResponse.json({ message: "Annotation updated successfully" });
  } catch (error) {
    console.error("Error updating annotation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}