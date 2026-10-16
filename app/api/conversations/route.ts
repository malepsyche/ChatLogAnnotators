import { NextResponse } from "next/server";
import {
  getCollection,
  getUserCollection,
  getDatabaseCollection,
} from "@/lib/cosmosdb";
import { ObjectId, Collection, Document } from "mongodb";

const MAX_BSON_SIZE = 16 * 1024 * 1024;

interface ConversationDocument extends Document {
  _id: ObjectId;
  annotations?: Document[];
  messages?: Document[];
}

async function canAddAnnotation(
  collection: Collection<ConversationDocument>,
  docId: ObjectId,
  newAnnotation: Document
) {
  const document = await collection.findOne({ _id: docId });

  return (
    Buffer.byteLength(JSON.stringify(document)) +
      Buffer.byteLength(JSON.stringify(newAnnotation)) <
    MAX_BSON_SIZE
  );
}

type Progress = "completed" | "in-progress" | "not-started";

function calculateProgress(
  doc: Document,
  annotatorNames: Set<string>
): {
  status: Progress;
  answered: number;
  total: number;
} {
  const annotations: Document[] = [
    ...(Array.isArray(doc.annotations) ? doc.annotations : []),
    ...(Array.isArray(doc.messages)
      ? doc.messages.flatMap((message: Document) =>
          Array.isArray(message.annotations) ? message.annotations : []
        )
      : []),
  ];

  const total = annotations.length;

  if (!total) {
    return {
      status: "not-started",
      answered: 0,
      total,
    };
  }

  const countFor = (username: string) =>
    annotations.filter(
      (annotation) =>
        Array.isArray(annotation.answers) &&
        annotation.answers.some(
          (answer: Document) =>
            answer &&
            typeof answer === "object" &&
            answer.name === username
        )
    ).length;

  const counts = [...annotatorNames].map(countFor);

  const answered = counts.length ? Math.max(...counts) : 0;

  return {
    status:
      answered === total
        ? "completed"
        : answered > 0
        ? "in-progress"
        : "not-started",
    answered,
    total,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const searchQuery = url.searchParams.get("query") || "";
    const username = url.searchParams.get("username");
    const name = url.searchParams.get("name");

    if (!username || !name) {
      return NextResponse.json(
        { error: "Missing username or databaseId parameter" },
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

    const databaseCollection = await getDatabaseCollection();

    const database = await databaseCollection.findOne({ name });

    if (!database) {
      return NextResponse.json(
        { error: "Database not found" },
        { status: 404 }
      );
    }

    const databaseObjectId = database._id.toString();

    const collection = await getCollection();

    const searchFilter = searchQuery
      ? {
          $or: [
            { person: { $regex: searchQuery, $options: "i" } },
            { Person: { $regex: searchQuery, $options: "i" } },
            { "stime.text": { $regex: searchQuery, $options: "i" } },
            { "last_interact.text": { $regex: searchQuery, $options: "i" } },
            { "messages.content": { $regex: searchQuery, $options: "i" } },
          ],
        }
      : {};

    let filter: Document = searchFilter;

    if (user.role === "annotator") {
      const assignment =
        user.assignedConversations?.[databaseObjectId];

      const ids: string[] = [
        ...(Array.isArray(assignment?.conversations)
          ? assignment.conversations
          : []),
        ...(Array.isArray(assignment?.assignments)
          ? assignment.assignments.flatMap(
              (a: Document) => a.conversations || []
            )
          : []),
      ];

      const validIds = [...new Set(ids)]
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      if (!validIds.length) {
        return NextResponse.json([]);
      }

      filter = {
        ...searchFilter,
        _id: { $in: validIds },
      };
    } else if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const documents = await collection
      .find(filter, {
        projection: {
          title: 1,
          person: 1,
          Person: 1,
          stime: 1,
          last_interact: 1,
          messages: 1,
          annotations: 1,
        },
      })
      .toArray();

    const annotatorNames = new Set<string>();

    if (user.role === "admin") {
      const possibleNames = new Set<string>();

      for (const doc of documents) {
        const annotations: Document[] = [
          ...(Array.isArray(doc.annotations) ? doc.annotations : []),
          ...(Array.isArray(doc.messages)
            ? doc.messages.flatMap((message: Document) =>
                Array.isArray(message.annotations)
                  ? message.annotations
                  : []
              )
            : []),
        ];

        for (const annotation of annotations) {
          for (const answer of annotation.answers || []) {
            if (
              answer &&
              typeof answer === "object" &&
              typeof answer.name === "string"
            ) {
              possibleNames.add(answer.name);
            }
          }
        }
      }

      if (possibleNames.size) {
        const annotators = await userCollection
          .find(
            {
              username: { $in: [...possibleNames] },
              role: "annotator",
            },
            {
              projection: {
                username: 1,
              },
            }
          )
          .toArray();

        for (const annotator of annotators) {
          annotatorNames.add(annotator.username);
        }
      }
    }

    return NextResponse.json(
      documents.map((doc) => ({
        _id: doc._id.toString(),
        title: doc.title || "Untitled",
        Person: (doc.person || doc.Person) ?? "Unknown",
        firstInteraction: doc.stime?.text || "No start time",
        lastInteraction:
          doc.last_interact?.text || "No last interaction",
        messages: doc.messages || [],
        annotations: doc.annotations || [],
        ...(user.role === "admin"
          ? {
              annotationProgress: calculateProgress(
                doc,
                annotatorNames
              ),
            }
          : {}),
      }))
    );
  } catch (error) {
    console.error("Error fetching conversations:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { annotation } = await req.json();

    if (!annotation?.title || !annotation?.type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const collection =
      (await getCollection()) as Collection<ConversationDocument>;

    const newAnnotation: Document = {
      _id: new ObjectId(),
      title: annotation.title,
      type: annotation.type,
      options: annotation.options || [],
      answers: annotation.answers || [],
    };

    const batchSize = 100;

    let skip = 0;

    while (true) {
      const documents = await collection
        .find({})
        .skip(skip)
        .limit(batchSize)
        .toArray();

      if (!documents.length) {
        break;
      }

      for (const doc of documents) {
        if (
          await canAddAnnotation(
            collection,
            doc._id,
            newAnnotation
          )
        ) {
          await collection.updateOne(
            { _id: doc._id },
            {
              $push: {
                annotations: newAnnotation,
              },
            }
          );
        } else {
          console.warn(
            `Skipping document ${doc._id} due to size limit`
          );
        }
      }

      skip += batchSize;
    }

    return NextResponse.json({
      message: "Annotation added successfully to eligible documents",
    });
  } catch (error) {
    console.error("Error adding annotation:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { annotationId } = await req.json();

    if (!annotationId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(annotationId)) {
      return NextResponse.json(
        { error: "Invalid annotation ID" },
        { status: 400 }
      );
    }

    const collection =
      (await getCollection()) as Collection<ConversationDocument>;

    const annotationObjectId = new ObjectId(annotationId);

    while (true) {
      const documents = await collection
        .find({
          "annotations._id": annotationObjectId,
        })
        .limit(100)
        .toArray();

      if (!documents.length) {
        break;
      }

      for (const doc of documents) {
        const result = await collection.updateOne(
          { _id: doc._id },
          {
            $pull: {
              annotations: {
                _id: annotationObjectId,
              },
            },
          }
        );

        console.log(
          `Deleted annotation from document ${doc._id}: ${result.modifiedCount}`
        );
      }
    }

    return NextResponse.json({
      message: "Annotation deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting annotation:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { annotationId, updatedFields } = await req.json();

    if (!annotationId || !updatedFields) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(annotationId)) {
      return NextResponse.json(
        { error: "Invalid annotation ID" },
        { status: 400 }
      );
    }

    const collection =
      (await getCollection()) as Collection<ConversationDocument>;

    const annotationObjectId = new ObjectId(annotationId);

    let totalModified = 0;

    while (true) {
      const documents = await collection
        .find({
          "annotations._id": annotationObjectId,
        })
        .limit(100)
        .toArray();

      if (!documents.length) {
        break;
      }

      for (const doc of documents) {
        const fields = Object.fromEntries(
          Object.entries(updatedFields).map(([key, value]) => [
            `annotations.$.${key}`,
            value,
          ])
        );

        const result = await collection.updateOne(
          {
            _id: doc._id,
            "annotations._id": annotationObjectId,
          },
          {
            $set: fields,
          }
        );

        totalModified += result.modifiedCount;
      }

      break;
    }

    return NextResponse.json({
      message: `Annotation updated successfully in ${totalModified} documents`,
    });
  } catch (error) {
    console.error(
      "Error updating annotation in all conversations:",
      error
    );

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}