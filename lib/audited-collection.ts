import { Collection, Db, Document, ObjectId } from "mongodb";
import { cookies } from "next/headers";

const tracked = ["assignments", "conversations", "databases", "users"];
const writes = [
    "insertOne", "insertMany", "updateOne", "updateMany", "replaceOne",
    "deleteOne", "deleteMany", "findOneAndUpdate", "findOneAndReplace",
    "findOneAndDelete", "bulkWrite"
];

async function getActor(): Promise<string> {
    try {
        return decodeURIComponent((await cookies()).get("username")?.value || "system");
    } catch {
        return "system";
    }
}

function getIds(before: Document[], result: unknown): string[] {
    const inserted = result as {
        insertedId?: ObjectId;
        insertedIds?: Record<string, ObjectId>;
    } | null;

    const ids = before.map((doc) => String(doc._id));

    if (inserted?.insertedId) {
        ids.push(String(inserted.insertedId));
    }

    if (inserted?.insertedIds) {
        ids.push(...Object.values(inserted.insertedIds).map(String));
    }

    return [...new Set(ids)];
}

function operationName(method: string): string {
    if (method.startsWith("insert")) return "created";
    if (method.startsWith("delete") || method === "findOneAndDelete") return "deleted";
    return "updated";
}

function changedFields(method: string, args: unknown[]): string[] {
    if (method === "bulkWrite") return ["multiple operations"];
    if (method.startsWith("insert")) return ["new document"];
    if (method.startsWith("delete") || method === "findOneAndDelete") return ["deleted document"];

    const update = args[1];
    if (!update || typeof update !== "object" || Array.isArray(update)) return [];

    const fields: string[] = [];
    for (const [key, value] of Object.entries(update)) {
        if (key.startsWith("$") && value && typeof value === "object" && !Array.isArray(value)) {
            fields.push(...Object.keys(value));
        } else if (!key.startsWith("$")) {
            fields.push(key);
        }
    }
    return [...new Set(fields)].slice(0, 30);
}

function changeDescription(name: string, fields: string[]): string {
    if (name === "conversations") {
        if (fields.some((field) => field.includes("comments"))) return "Comment updated";
        if (fields.some((field) => field.includes("adminResolution"))) return "Admin resolution updated";
        if (fields.some((field) => field.includes("answers"))) return "Annotation answer updated";
        if (fields.some((field) => field.includes("annotations"))) return "Annotation updated";
    }
    const singular: Record<string, string> = {
        conversations: "Conversation",
        assignments: "Assignment",
        databases: "Database",
        users: "User"
    };
    return singular[name] || "Document";
}

function documentLabel(doc: Document | undefined): string | undefined {
    if (!doc) return undefined;
    const value = doc.title || doc.person || doc.name || doc.username;
    return typeof value === "string" ? value : undefined;
}
async function notify(
    db: Db,
    name: string,
    ids: string[],
    actor: string,
    action: string,
    details: Document,
    before: Document[]
): Promise<void> {
    // Only conversation and annotation changes generate notifications.
    // All other changes are still recorded in Audit History.
    if (name !== "conversations") {
        return;
    }

    const admins = await db.collection("users").find({
        role: "admin",
        isDeleted: { $ne: true }
    }).toArray();

    const recipients = admins.map((user) => String(user.username));

    const assignments = await db.collection("assignments").find({
        conversations: { $in: ids }
    }).toArray();

    for (const assignment of assignments) {
        if (Array.isArray(assignment.annotators)) {
            recipients.push(...assignment.annotators);
        }
    }

    const unique = [...new Set(recipients)].filter(
        (username) => username && username !== actor
    );

    if (unique.length === 0) {
        return;
    }

    await db.collection("notifications").insertMany(
        unique.map((username) => ({
            username,
            actor,
            action,
            target: ids[0] || "multiple",
            details,
            read: false,
            createdAt: new Date()
        }))
    );
}

export function auditedCollection<T extends Document>(
    collection: Collection<T>,
    getSystemDatabase: () => Promise<Db>
): Collection<T> {
    if (!tracked.includes(collection.collectionName)) return collection;

    return new Proxy(collection, {
        get(target, property) {
            const value = Reflect.get(target, property, target);
            if (typeof value !== "function") return value;

            const method = String(property);
            if (!writes.includes(method)) return value.bind(target);

            return async (...args: unknown[]) => {
                let before: Document[] = [];
                if (!method.startsWith("insert") && method !== "bulkWrite") {
                    before = await target.find(args[0] as Document).limit(100).toArray();
                }

                const result: unknown = await value.apply(target, args);

                try {
                    const db = await getSystemDatabase();
                    const actor = await getActor();
                    const ids = getIds(before, result);
                    const name = collection.collectionName;
                    const fields = changedFields(method, args);
                    const operation = operationName(method);
                    const labels = before.map(documentLabel).filter((label): label is string => !!label);

                    if (labels.length === 0 && ids.length > 0) {
                        const insertedIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
                        const after = await target.find({ _id: { $in: insertedIds } } as Document).limit(100).toArray();
                        labels.push(...after.map(documentLabel).filter((label): label is string => !!label));
                    }

                    const details = {
                        collection: name,
                        method,
                        operation,
                        ids,
                        label: labels[0] || "",
                        fields,
                        summary: changeDescription(name, fields)
                    };
                    const action = `${name}.${method}`;
                    const now = new Date();

                    await db.collection("audit_events").insertOne({
                        actor,
                        action,
                        target: ids[0] || "multiple",
                        details,
                        createdAt: now
                    });

                    await notify(db, name, ids, actor, action, details, before);
                } catch (error) {
                    console.error("Audit failed after database write:", error);
                }
                return result;
            };
        }
    });
}
