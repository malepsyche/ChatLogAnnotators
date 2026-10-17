"use client";

import { useCallback, useEffect, useState } from "react";
import { Conversation, Annotation, Answer } from "@/types/conversations";
import { toast } from "react-toastify";
import { useAssignment } from "@/components/context/assignment-context";

type ConversationWithLock = Conversation & {
  lock?: {
    isLocked: boolean;
    lockedBy?: string | null;
    lockedAt?: number | null;
  };
  effectiveLock?: {
    conversationLocked: boolean;
    assignmentLocked: boolean;
    isLocked: boolean;
  };
};

function getUsername(): string {
  if (typeof document === "undefined") {
    return "Anonymous";
  }

  const cookieValue = document.cookie
    .split("; ")
    .find((row) => row.startsWith("username="))
    ?.split("=")[1];

  return cookieValue ? decodeURIComponent(cookieValue) : "Anonymous";
}

function replaceAnswer(
  annotations: Annotation[] = [],
  annotationId: string,
  content: string[],
  username: string
): Annotation[] {
  return annotations.map((annotation) => {
    if (String(annotation._id) !== annotationId) {
      return annotation;
    }

    const answers = annotation.answers || [];

    const existing = answers.some(
      (answer) => answer.name === username
    );

    const updatedAnswers: Answer[] = existing
      ? answers.map((answer) =>
          answer.name === username
            ? {
                ...answer,
                content,
              }
            : answer
        )
      : [
          ...answers,
          {
            _id: new Date().toISOString(),
            name: username,
            timestamp: Date.now(),
            content,
          } as Answer,
        ];

    return {
      ...annotation,
      answers: updatedAnswers,
    };
  });
}

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const [conversation, setConversation] =
    useState<ConversationWithLock | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(
    null
  );

  const { activeAssignment } = useAssignment();

  const [localCommentContent, setLocalCommentContent] = useState<
    Record<number, string>
  >({});

  const [busyComments, setBusyComments] = useState<
    Record<number, boolean>
  >({});

  const refreshConversation = useCallback(async (id: string) => {
    if (!activeAssignment) {
      throw new Error("No active assignment selected");
    }

    const response = await fetch(
      `/api/conversations/${encodeURIComponent(
        id
      )}?assignmentId=${encodeURIComponent(activeAssignment)}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      throw new Error(
        data.error || data.message || "Failed to fetch conversation"
      );
    }

    const data: ConversationWithLock = await response.json();

    setConversation(data);

    return data;
  }, [activeAssignment]);

  useEffect(() => {
    if (!activeAssignment) {
      return;
    }

    let cancelled = false;

    params
      .then(async ({ conversationId: id }) => {
        if (cancelled) return;

        setConversationId(id);
        setConversation(null);
        setError(null);
        setActiveMessageIndex(null);

        try {
          await refreshConversation(id);
        } catch (err) {
          if (!cancelled) {
            console.error("Error fetching conversation:", err);

            setError(
              err instanceof Error
                ? err.message
                : "Failed to load conversation"
            );

            toast.error("Failed to load conversation");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Error resolving params:", err);
          setError("Invalid conversation ID");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params, refreshConversation]);

  const isLocked =
    conversation?.effectiveLock?.isLocked ??
    conversation?.lock?.isLocked ??
    false;

  const updateLocalAnswer = (
    annotationId: string,
    content: string[],
    messageIndex?: number
  ) => {
    if (isLocked) return;

    const username = getUsername();

    setConversation((prev) => {
      if (!prev) return null;

      if (messageIndex === undefined) {
        return {
          ...prev,
          annotations: replaceAnswer(
            prev.annotations || [],
            annotationId,
            content,
            username
          ),
        };
      }

      return {
        ...prev,
        messages: prev.messages.map((message, index) =>
          index === messageIndex
            ? {
                ...message,
                annotations: replaceAnswer(
                  message.annotations || [],
                  annotationId,
                  content,
                  username
                ),
              }
            : message
        ),
      };
    });
  };

  const saveAnswer = async (
    annotationId: string,
    content: string[],
    messageIndex?: number
  ) => {
    if (!conversationId || isLocked) return;

    const url =
      messageIndex === undefined
        ? `/api/conversations/${conversationId}`
        : `/api/conversations/${conversationId}/messages/${messageIndex}`;

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: conversationId,
          assignmentId: activeAssignment,
          annotationId,
          updatedAnswer: content,
          name: getUsername(),
          ...(messageIndex !== undefined ? { messageIndex } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          data.error || data.message || "Failed to save annotation"
        );
      }

      toast.success("Answer saved successfully");
    } catch (err) {
      console.error("Error saving annotation:", err);

      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to save annotation"
      );

      await refreshConversation(conversationId).catch(console.error);
    }
  };

  const handleAddComment = async (messageIndex: number) => {
    if (!conversationId || isLocked || busyComments[messageIndex]) {
      return;
    }

    const content = localCommentContent[messageIndex]?.trim();

    if (!content) return;

    setBusyComments((prev) => ({
      ...prev,
      [messageIndex]: true,
    }));

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages/${messageIndex}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: conversationId,
            assignmentId: activeAssignment,
            comment: {
              name: getUsername(),
              timestamp: Date.now(),
              content,
            },
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          data.error || data.message || "Failed to add comment"
        );
      }

      setLocalCommentContent((prev) => ({
        ...prev,
        [messageIndex]: "",
      }));

      await refreshConversation(conversationId);

      toast.success("Comment added successfully");
    } catch (err) {
      console.error("Error adding comment:", err);

      toast.error(
        err instanceof Error ? err.message : "Failed to add comment"
      );
    } finally {
      setBusyComments((prev) => ({
        ...prev,
        [messageIndex]: false,
      }));
    }
  };

  const handleDeleteComment = async (
    messageIndex: number,
    commentId: string
  ) => {
    if (!conversationId || isLocked || busyComments[messageIndex]) {
      return;
    }

    setBusyComments((prev) => ({
      ...prev,
      [messageIndex]: true,
    }));

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages/${messageIndex}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: conversationId,
            assignmentId: activeAssignment,
            commentId,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          data.error || data.message || "Failed to delete comment"
        );
      }

      await refreshConversation(conversationId);

      toast.success("Comment deleted successfully");
    } catch (err) {
      console.error("Error deleting comment:", err);

      toast.error(
        err instanceof Error ? err.message : "Failed to delete comment"
      );
    } finally {
      setBusyComments((prev) => ({
        ...prev,
        [messageIndex]: false,
      }));
    }
  };

  const renderAnnotation = (
    annotation: Annotation,
    messageIndex?: number
  ) => {
    const username = getUsername();

    const answer = annotation.answers?.find(
      (item) => item.name === username
    );

    const selected = answer?.content || [];

    const update = (
      content: string[],
      saveImmediately = true
    ) => {
      if (isLocked) return;

      updateLocalAnswer(
        String(annotation._id),
        content,
        messageIndex
      );

      if (saveImmediately) {
        void saveAnswer(
          String(annotation._id),
          content,
          messageIndex
        );
      }
    };

    if (annotation.type === "textbox") {
      return (
        <textarea
          className="w-full p-2 border border-muted rounded-md bg-card text-card-foreground resize-none disabled:opacity-60"
          value={selected[0] || ""}
          disabled={isLocked}
          onChange={(e) => {
            update([e.target.value], false);
          }}
          onBlur={(e) => {
            if (!isLocked) {
              void saveAnswer(
                String(annotation._id),
                [e.target.value],
                messageIndex
              );
            }
          }}
          rows={3}
          wrap="soft"
          placeholder={
            isLocked
              ? "Conversation locked"
              : "Type your answer here..."
          }
        />
      );
    }

    if (annotation.type === "multiple choice") {
      return (
        <div className="flex flex-col">
          {annotation.options?.map((option, index) => (
            <label
              key={index}
              className="flex items-center space-x-2"
            >
              <input
                type="radio"
                name={`${messageIndex ?? "conversation"}-${annotation._id}`}
                disabled={isLocked}
                checked={selected[0] === option}
                onChange={() => update([option])}
              />

              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    if (annotation.type === "multiple answers") {
      return (
        <div className="flex flex-col">
          {annotation.options?.map((option, index) => (
            <label
              key={index}
              className="flex items-center space-x-2"
            >
              <input
                type="checkbox"
                disabled={isLocked}
                checked={selected.includes(option)}
                onChange={(e) => {
                  const updatedContent = e.target.checked
                    ? Array.from(new Set([...selected, option]))
                    : selected.filter((value) => value !== option);

                  update(updatedContent);
                }}
              />

              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    if (annotation.type === "scaler") {
      return (
        <div className="flex items-center space-x-4">
          <input
            type="range"
            className="w-full accent-primary"
            disabled={isLocked}
            min={annotation.options?.[0] || "1"}
            max={annotation.options?.[1] || "10"}
            step={annotation.options?.[2] || "1"}
            value={
              selected[0] || annotation.options?.[0] || "1"
            }
            onChange={(e) => {
              update([e.target.value], false);
            }}
            onPointerUp={(e) => {
              if (!isLocked) {
                void saveAnswer(
                  String(annotation._id),
                  [(e.target as HTMLInputElement).value],
                  messageIndex
                );
              }
            }}
            onKeyUp={(e) => {
              if (!isLocked) {
                void saveAnswer(
                  String(annotation._id),
                  [(e.target as HTMLInputElement).value],
                  messageIndex
                );
              }
            }}
          />

          <span className="text-foreground font-semibold">
            {selected[0] || annotation.options?.[0] || "1"}
          </span>
        </div>
      );
    }

    return (
      <span className="text-muted-foreground">
        Unsupported annotation type
      </span>
    );
  };

  const renderAnnotationTable = (
    annotations: Annotation[] = [],
    messageIndex?: number
  ) => (
    <table className="w-full mt-2 border border-muted shadow-sm mb-3 text-foreground">
      <thead className="bg-secondary text-secondary-foreground">
        <tr>
          <th
            className="border py-2 px-4 text-left"
            style={{ width: "30%" }}
          >
            Title
          </th>

          <th
            className="border py-2 px-4 text-left"
            style={{ width: "70%" }}
          >
            Answer
          </th>
        </tr>
      </thead>

      <tbody>
        {annotations.map((annotation) => (
          <tr
            key={String(annotation._id)}
            className="even:bg-secondary"
          >
            <td className="py-2 px-4 border border-muted">
              {annotation.title}
            </td>

            <td className="py-2 px-4 border border-muted">
              {renderAnnotation(annotation, messageIndex)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (error) {
    return <p className="text-red-500 p-4">{error}</p>;
  }

  if (!conversation) {
    return (
      <p className="bg-muted text-muted-foreground p-4">
        Loading conversation...
      </p>
    );
  }

  return (
    <div className="p-4 bg-background text-foreground min-h-screen flex flex-col">
      <div className="flex-none">
        <h1 className="text-2xl font-bold text-foreground">
          Home: Annotate The Message
        </h1>

        {isLocked && (
          <div
            className="mt-3 p-3 bg-yellow-100 text-yellow-900 rounded"
            role="status"
          >
            <strong>Read-only: </strong>

            {conversation.effectiveLock?.assignmentLocked &&
            conversation.effectiveLock?.conversationLocked
              ? "This assignment and conversation are locked."
              : conversation.effectiveLock?.assignmentLocked
              ? "This assignment is locked."
              : "This conversation is locked."}

            {" "}You can view your answers and comments, but cannot change them.
          </div>
        )}

        {renderAnnotationTable(conversation.annotations || [])}
      </div>

      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">
          Conversations
        </h1>

        {conversation.messages.map((message, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              message.role === "user"
                ? "bg-primary text-primary-foreground ml-auto"
                : "bg-muted text-muted-foreground mr-auto"
            }`}
          >
            <p
              className={`font-semibold ${
                message.role === "user"
                  ? "text-muted"
                  : "text-muted-foreground"
              }`}
            >
              {message.role === "user" ? "You" : "AI"}
            </p>

            <p className="mt-2 leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>

            <button
              type="button"
              className="bg-yellow-200 rounded-md p-2 text-black mt-2 hover:bg-yellow-300 transition duration-300"
              onClick={() => {
                setActiveMessageIndex(
                  activeMessageIndex === index ? null : index
                );
              }}
            >
              {activeMessageIndex === index
                ? "Hide Annotations"
                : "Show Annotations"}
            </button>

            {activeMessageIndex === index &&
              renderAnnotationTable(
                message.annotations || [],
                index
              )}

            <div className="mt-2">
              <h2 className="text-lg font-semibold text-foreground">
                Comments
              </h2>

              {message.comments
                ?.filter(
                  (comment) => comment.name === getUsername()
                )
                .map((comment) => (
                  <div
                    key={String(comment._id)}
                    className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md mb-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {comment.name}
                      </p>

                      <p className="mt-1 text-gray-800 dark:text-gray-300">
                        {comment.content}
                      </p>
                    </div>

                    {!isLocked && (
                      <button
                        type="button"
                        disabled={busyComments[index]}
                        className="text-red-500 hover:text-red-600 transition duration-300 font-medium disabled:opacity-50"
                        onClick={() =>
                          void handleDeleteComment(
                            index,
                            String(comment._id)
                          )
                        }
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}

              {!isLocked && (
                <div className="flex items-center mt-4">
                  <input
                    type="text"
                    className="w-full p-2 border border-muted rounded-l-md bg-card text-card-foreground focus:outline-none"
                    value={localCommentContent[index] || ""}
                    disabled={busyComments[index]}
                    onChange={(e) =>
                      setLocalCommentContent((prev) => ({
                        ...prev,
                        [index]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void handleAddComment(index);
                      }
                    }}
                    placeholder="Type your comment here..."
                  />

                  <button
                    type="button"
                    disabled={
                      busyComments[index] ||
                      !localCommentContent[index]?.trim()
                    }
                    className="bg-blue-500 text-white p-2 rounded-r-md hover:bg-blue-600 transition duration-300 disabled:opacity-50"
                    onClick={() => {
                      void handleAddComment(index);
                    }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}