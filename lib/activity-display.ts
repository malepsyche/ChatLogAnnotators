export interface ActivityDetails {
    conversationId?: string;
    conversationTitle?: string;

    annotationId?: string;
    annotationTitle?: string;
    questionIndex?: number;

    previousAnswer?: string[];
    updatedAnswer?: string[];

    assignmentId?: string | null;

    collection?: string;
    method?: string;
    operation?: string;

    label?: string;
    summary?: string;
    title?: string;
    fields?: string[];
}

export interface ActivityItem {
    _id: string;
    actor?: string;
    action: string;
    target?: string;
    details?: ActivityDetails;
    createdAt: string;
    read?: boolean;
}

export function activityTitle(item: ActivityItem): string {
    const titles: Record<string, string> = {
        "annotation.answer_submitted": "Annotation submitted",
        "annotation.answer_changed": "Annotation answer changed",
        "annotation.resolved": "Admin resolution updated",

        "resolution.updated": "Admin resolution updated",

        "assignment.created": "Assignment created",
        "assignment.updated": "Assignment updated",

        "conversations.insertOne": "Conversation created",
        "conversations.updateOne": "Conversation updated",
        "conversations.deleteOne": "Conversation deleted",

        "assignments.insertOne": "Assignment created",
        "assignments.updateOne": "Assignment updated",
        "assignments.deleteOne": "Assignment deleted",

        "users.insertOne": "User created",
        "users.updateOne": "User updated",
        "users.deleteOne": "User deleted",

        "databases.insertOne": "Database added",
        "databases.updateOne": "Database updated",
        "databases.deleteOne": "Database deleted"
    };

    if (titles[item.action]) {
        return titles[item.action];
    }

    const summary = item.details?.summary;

    if (summary) {
        const operation = item.details?.operation || "";

        if (summary.toLowerCase().endsWith(operation.toLowerCase())) {
            return summary;
        }

        return operation
            ? `${summary} ${operation}`
            : summary;
    }

    return "Activity recorded";
}

export function activityDescription(item: ActivityItem): string {
    const actor = item.actor || "Someone";
    const details = item.details || {};

    const conversation = details.conversationTitle || "a conversation";
    const question = details.annotationTitle || "an annotation";

    switch (item.action) {
        case "annotation.answer_submitted":
            return `${actor} submitted an answer to "${question}" in "${conversation}".`;

        case "annotation.answer_changed":
            return `${actor} changed their answer to "${question}" in "${conversation}".`;

        case "annotation.resolved":
            return `${actor} resolved "${question}" in "${conversation}".`;

        case "assignment.created":
            return `${actor} created an assignment.`;

        case "assignment.updated":
            return `${actor} updated an assignment.`;

        default: {
            const title = activityTitle(item).toLowerCase();
            const label = details.label || details.conversationTitle;

            return label
                ? `${actor} performed "${title}" on "${label}".`
                : `${actor} performed "${title}".`;
        }
    }
}

export function activityDate(value: string): string {
    return new Date(value).toLocaleString("en-SG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

export function formatAnswer(values?: string[]): string {
    if (!values || values.length === 0) {
        return "No previous answer";
    }

    return values.join(", ");
}

export function hasAnswerChanges(item: ActivityItem): boolean {
    return (
        item.action === "annotation.answer_submitted" ||
        item.action === "annotation.answer_changed" ||
        item.action === "annotation.resolved"
    );
}