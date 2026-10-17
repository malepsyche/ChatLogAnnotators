"use client";

import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";

import {
    ActivityItem,
    activityTitle,
    activityDescription,
    activityDate,
    formatAnswer,
    hasAnswerChanges
} from "@/lib/activity-display";

export default function Notifications() {
    const [items, setItems] = useState<ActivityItem[]>([]);

    async function loadNotifications() {
        try {
            const response = await fetch(
                "/api/workflow/notifications",
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error("Failed to load notifications");
            }

            const data: unknown = await response.json();

            if (Array.isArray(data)) {
                setItems(data);
            }
        } catch (error) {
            console.error(error);
        }
    }

    useEffect(() => {
        void loadNotifications();

        const timer = setInterval(() => {
            void loadNotifications();
        }, 60000);

        return () => clearInterval(timer);
    }, []);

    async function markAsRead(id: string) {
        const response = await fetch(
            "/api/workflow/notifications",
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ id })
            }
        );

        if (response.ok) {
            setItems((previous) =>
                previous.map((item) =>
                    item._id === id
                        ? { ...item, read: true }
                        : item
                )
            );
        }
    }

    const unread = items.filter((item) => !item.read).length;

    return (
        <main className="w-full max-w-4xl space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-semibold">
                    Notifications
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">
                    {unread} unread notifications
                </p>
            </div>

            {items.length === 0 && (
                <div className="rounded-lg border p-8 text-center">
                    <Bell className="mx-auto mb-3 opacity-50" />

                    <p className="text-sm text-muted-foreground">
                        No notifications yet.
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {items.map((item) => (
                    <article
                        key={item._id}
                        className={`rounded-lg border p-4 ${
                            item.read
                                ? "opacity-60"
                                : "bg-secondary/20"
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <Bell className="mt-1 h-5 w-5 shrink-0" />

                            <div className="min-w-0 flex-1 space-y-2">
                                <h2 className="text-sm font-semibold">
                                    {activityTitle(item)}
                                </h2>

                                <p className="text-sm">
                                    {activityDescription(item)}
                                </p>

                                {hasAnswerChanges(item) && (
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-medium">
                                            Answer:
                                        </span>{" "}
                                        {formatAnswer(item.details?.updatedAnswer)}
                                    </p>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    {activityDate(item.createdAt)}
                                </p>

                                {!item.read && (
                                    <button
                                        onClick={() => void markAsRead(item._id)}
                                        className="mt-2 flex items-center gap-2 rounded border px-3 py-2 text-xs hover:bg-secondary"
                                    >
                                        <Check className="h-4 w-4" />
                                        Mark as read
                                    </button>
                                )}
                            </div>

                            {!item.read && (
                                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            )}
                        </div>
                    </article>
                ))}
            </div>
        </main>
    );
}