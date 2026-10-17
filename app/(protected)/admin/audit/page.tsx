"use client";

import { useEffect, useState } from "react";
import { Activity, FileText } from "lucide-react";

import {
    ActivityItem,
    activityTitle,
    activityDescription,
    activityDate,
    formatAnswer,
    hasAnswerChanges
} from "@/lib/activity-display";

export default function AuditPage() {
    const [events, setEvents] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadEvents() {
            try {
                const response = await fetch("/api/workflow/audit", {
                    cache: "no-store"
                });

                if (!response.ok) {
                    throw new Error("Failed to load audit history");
                }

                const data: unknown = await response.json();

                setEvents(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error(error);
                setError("Unable to load audit history.");
            } finally {
                setLoading(false);
            }
        }

        void loadEvents();
    }, []);

    return (
        <main className="w-full max-w-5xl space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-semibold">
                    Audit History
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">
                    Detailed changes made by administrators and annotators.
                </p>
            </div>

            {loading && (
                <p className="text-sm text-muted-foreground">
                    Loading activity...
                </p>
            )}

            {error && (
                <p className="text-sm text-red-500">
                    {error}
                </p>
            )}

            {!loading && !error && events.length === 0 && (
                <div className="rounded-lg border p-8 text-center">
                    <Activity className="mx-auto mb-3 opacity-50" />

                    <p className="text-sm text-muted-foreground">
                        No activity recorded yet.
                    </p>
                </div>
            )}

            <div className="space-y-4">
                {events.map((event) => {
                    const details = event.details;
                    const showAnswers = hasAnswerChanges(event);

                    return (
                        <article
                            key={event._id}
                            className="w-full rounded-lg border p-5"
                        >
                            <div className="flex items-start gap-3">
                                <div className="shrink-0 rounded-full bg-secondary p-2">
                                    <FileText className="h-5 w-5" />
                                </div>

                                <div className="min-w-0 flex-1 space-y-3">
                                    <div>
                                        <h2 className="font-semibold">
                                            {activityTitle(event)}
                                        </h2>

                                        <p className="mt-1 break-words text-sm">
                                            {activityDescription(event)}
                                        </p>

                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {activityDate(event.createdAt)}
                                        </p>
                                    </div>

                                    {showAnswers && details && (
                                        <div className="space-y-3 rounded-lg border bg-secondary/20 p-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Question
                                                </p>

                                                <p className="mt-1 text-sm font-medium">
                                                    {details.annotationTitle || "Unknown question"}
                                                </p>
                                            </div>

                                            {event.action === "annotation.answer_changed" && (
                                                <div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Previous answer
                                                    </p>

                                                    <p className="mt-1 text-sm">
                                                        {formatAnswer(details.previousAnswer)}
                                                    </p>
                                                </div>
                                            )}

                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    {event.action === "annotation.resolved"
                                                        ? "Final resolution"
                                                        : "Updated answer"}
                                                </p>

                                                <p className="mt-1 text-sm font-medium">
                                                    {formatAnswer(details.updatedAnswer)}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {!showAnswers && details?.label && (
                                        <p className="text-sm text-muted-foreground">
                                            Record: {details.label}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </main>
    );
}