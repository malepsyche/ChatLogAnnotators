import type { Conversation } from "@/types/conversations";

export type Completion = "not-started" | "in-progress" | "completed";
export type Consensus = "pending" | "reached" | "not-reached";
type AnswerLike = { name?: string; content?: string[] | null } | string;
type AnnotationLike = { answers?: AnswerLike[]; adminResolution?: { content?: string[] } };

type Source = Pick<Conversation, "annotations" | "messages">;
export function allAnnotations(doc: Source): AnnotationLike[] {
    return [...(doc.annotations || []), ...(doc.messages || []).flatMap((message) => message.annotations || [])];
}
function response(annotation: AnnotationLike, name: string): string[] | null {
    const answer = (annotation.answers || []).find((item) => typeof item === "object" && item !== null && item.name === name);
    return answer && typeof answer === "object" && Array.isArray(answer.content) ? answer.content : null;
}
export function completion(doc: Source, name: string): Completion {
    const annotations = allAnnotations(doc);
    if (!annotations.length) return "not-started";
    const count = annotations.filter((annotation) => response(annotation, name) !== null).length;
    return count === annotations.length ? "completed" : count ? "in-progress" : "not-started";
}
export function aggregateCompletion(doc: Source, names: string[]): Completion {
    if (!names.length) return "not-started";
    const states = names.map((name) => completion(doc, name));
    return states.every((state) => state === "completed") ? "completed" : states.every((state) => state === "not-started") ? "not-started" : "in-progress";
}
export function consensus(doc: Source, names: string[]): Consensus {
    const annotations = allAnnotations(doc);
    if (names.length < 2 || !annotations.length) return "pending";
    for (const annotation of annotations) {
        const answers = names.map((name) => response(annotation, name));
        if (answers.some((answer) => answer === null)) return "pending";
    }
    const disagreed = annotations.some((annotation) => {
        const values = names.map((name) => JSON.stringify([...(response(annotation, name) || [])].sort()));
        return values.some((value) => value !== values[0]);
    });
    return disagreed ? "not-reached" : "reached";
}
export function isAdminResolved(doc: Source): boolean {
    const annotations = allAnnotations(doc);
    return annotations.length > 0 && annotations.every((annotation) => Array.isArray(annotation.adminResolution?.content));
}
export function needsReview(doc: Source, names: string[]): boolean {
    if (consensus(doc, names) !== "not-reached") return false;
    return allAnnotations(doc).some((annotation) => {
        const values = names.map((name) => JSON.stringify([...(response(annotation, name) || [])].sort()));
        return values.some((value) => value !== values[0]) && !Array.isArray(annotation.adminResolution?.content);
    });
}
