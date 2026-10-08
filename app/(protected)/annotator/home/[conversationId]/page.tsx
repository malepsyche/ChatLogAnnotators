"use client";

import { useEffect, useState } from "react";
import { Conversation, Annotation } from "@/types/conversations";
import { toast } from "react-toastify";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(
    null
  );
  const [messageAnnotation, setMessageAnnotation] = useState<Annotation[]>([]);
  const [localCommentContent, setLocalCommentContent] = useState<
    Record<number, string>
  >({});
  const [refreshTrigger, setRefreshTrigger] = useState<boolean>(false);

  useEffect(() => {
    params
      .then(({ conversationId }) => {
        setConversationId(conversationId);

        fetch(`/api/conversations/${conversationId}`)
          .then((res) => {
            if (!res.ok) throw new Error("Failed to fetch conversation");
            return res.json();
          })
          .then((data) => {
            setConversation(data);
          })
          .catch((error) => {
            toast.error("Error fetching conversation:", error);
            setError("Failed to load conversation");
          });
      })
      .catch((error) => {
        toast.error("Error resolving params:", error);
        setError("Invalid conversation ID");
      });
  }, [params, refreshTrigger]);

  const handleSaveAnswer = (annotationId: string, updatedContent: string[]) => {
    if (!conversationId) return;

    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith("username="))
      ?.split("=")[1];
    const username = cookieValue
      ? decodeURIComponent(cookieValue)
      : "Anonymous";

    const payload = {
      id: conversationId,
      annotationId,
      updatedAnswer: updatedContent,
      name: username,
    };

    console.log("Payload being sent to server:", payload);

    fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => {
            throw new Error(err.message || "Failed to save answer");
          });
        }
        return res.json();
      })
      .then(() => {
        toast.success("Answer saved successfully");

        setConversation((prev) =>
          prev
            ? {
                ...prev,
                annotations: prev.annotations?.map((annotation) =>
                  annotation._id === annotationId
                    ? {
                        ...annotation,
                        answers: annotation.answers?.some(
                          (ans) => ans.name === username
                        )
                          ? annotation.answers.map((ans) =>
                              ans.name === username
                                ? { ...ans, content: updatedContent }
                                : ans
                            )
                          : [
                              ...annotation.answers,
                              {
                                _id: new Date().toISOString(),
                                name: username,
                                timestamp: Date.now(),
                                content: updatedContent,
                              },
                            ],
                      }
                    : annotation
                ),
              }
            : null
        );
      })
      .catch((err) => {
        console.error("Error saving answer:", err);
        toast.error("Error saving answer: " + err.message);
      });
  };

  const handleSaveMessageAnnotation = (
    annotationId: string,
    updatedContent: string[]
  ) => {
    if (!conversationId || activeMessageIndex === null) return;

    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith("username="))
      ?.split("=")[1];
    const username = cookieValue
      ? decodeURIComponent(cookieValue)
      : "Anonymous";

    const payload = {
      id: conversationId,
      messageIndex: activeMessageIndex,
      annotationId,
      updatedAnswer: updatedContent,
      name: username,
    };

    console.log("Payload being sent to server (Message Level):", payload);

    fetch(
      `/api/conversations/${conversationId}/messages/${activeMessageIndex}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to save message annotation");
        return res.json();
      })
      .then(() => {
        toast.success("Message annotation saved successfully");
        setConversation((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((message, index) =>
                  index === activeMessageIndex
                    ? {
                        ...message,
                        annotations: message.annotations?.map((annotation) =>
                          annotation._id === annotationId
                            ? {
                                ...annotation,
                                answers: annotation.answers?.some(
                                  (ans) => ans.name === username
                                )
                                  ? annotation.answers.map((ans) =>
                                      ans.name === username
                                        ? { ...ans, content: updatedContent }
                                        : ans
                                    )
                                  : [
                                      ...annotation.answers,
                                      {
                                        _id: new Date().toISOString(),
                                        name: username,
                                        timestamp: Date.now(),
                                        content: updatedContent,
                                      },
                                    ],
                              }
                            : annotation
                        ),
                      }
                    : message
                ),
              }
            : null
        );
      })
      .catch((err) => {
        console.error("Error saving message annotation:", err);
        toast.error("Error saving message annotation: " + err.message);
      });
  };

  const handleDeleteComment = (messageIndex: number, commentId: string) => {
    if (!conversationId || !commentId) return;

    fetch(`/api/conversations/${conversationId}/messages/${messageIndex}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: conversationId,
        commentId,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete comment");
        return res.json();
      })
      .then(() => {
        toast.success("Comment deleted successfully");
        setRefreshTrigger((prev) => !prev);
      })
      .catch((err) => toast.error("Error deleting comment: " + err.message));
  };

  const handleAddComment = (messageIndex: number, commentContent: string) => {
    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith("username="))
      ?.split("=")[1];

    const username = cookieValue
      ? decodeURIComponent(cookieValue)
      : "Anonymous";

    if (!conversationId || !commentContent) return;

    fetch(`/api/conversations/${conversationId}/messages/${messageIndex}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: conversationId,
        comment: {
          name: username,
          timestamp: Date.now(),
          content: commentContent,
        },
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to add comment");
        return res.json();
      })
      .then(() => {
        toast.success("Comment added successfully");
        setRefreshTrigger((prev) => !prev);
        setLocalCommentContent((prev) => ({ ...prev, [messageIndex]: "" }));
      })
      .catch((err) => toast.error("Error adding comment: " + err.message));
  };

  if (error) {
    return <p className="text-red-500 p-4">{error}</p>;
  }

  if (!conversation) {
    return (
      <p className="bg-muted text-muted-foreground p-4 w-width">
        Loading conversation...
      </p>
    );
  }

  return (
    <div className="p-4 bg-background text-foreground h-screen flex flex-col">
      <div className="flex-none">
        <h1 className="text-2xl font-bold text-foreground">
          Home: Annotate The Message
        </h1>
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
                style={{ width: "60%" }}
              >
                Answer
              </th>
            </tr>
          </thead>
          <tbody>
            {conversation.annotations?.map((annotation) => (
              <tr key={annotation._id} className="even:bg-secondary">
                <td className="py-2 px-4 border border-muted">
                  {annotation.title}
                </td>
                <td className="py-2 px-4 border border-muted">
                  {annotation.type === "textbox" && (
                    <textarea
                      className="w-full p-2 border border-muted rounded-md bg-card text-card-foreground resize-none"
                      value={
                        annotation.answers?.find(
                          (ans) =>
                            ans.name ===
                            (document.cookie
                              .split("; ")
                              .find((row) => row.startsWith("username="))
                              ?.split("=")[1] || "Anonymous")
                        )?.content?.[0] || ""
                      }
                      onChange={(e) => {
                        const username =
                          document.cookie
                            .split("; ")
                            .find((row) => row.startsWith("username="))
                            ?.split("=")[1] || "Anonymous";

                        setConversation((prev) =>
                          prev
                            ? {
                                ...prev,
                                annotations: prev.annotations?.map((a) =>
                                  a._id === annotation._id
                                    ? {
                                        ...a,
                                        answers: a.answers
                                          ? a.answers.some(
                                              (ans) => ans.name === username
                                            )
                                            ? a.answers.map((ans) =>
                                                ans.name === username
                                                  ? {
                                                      ...ans,
                                                      content: [e.target.value],
                                                    }
                                                  : ans
                                              )
                                            : [
                                                ...a.answers,
                                                {
                                                  _id: new Date().toISOString(),
                                                  name: username,
                                                  timestamp: Date.now(),
                                                  content: [e.target.value],
                                                },
                                              ]
                                          : [
                                              {
                                                _id: new Date().toISOString(),
                                                name: username,
                                                timestamp: Date.now(),
                                                content: [e.target.value],
                                              },
                                            ],
                                      }
                                    : a
                                ),
                              }
                            : null
                        );

                        handleSaveAnswer(annotation._id, [e.target.value]);
                      }}
                      onBlur={(e) =>
                        handleSaveAnswer(annotation._id, [e.target.value])
                      }
                      rows={3}
                      wrap="soft"
                      placeholder="Type your answer here..."
                    ></textarea>
                  )}

                  {annotation.type === "multiple choice" && (
                    <div className="flex flex-col">
                      {annotation.options?.map((option, index) => (
                        <label
                          key={index}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="radio"
                            name={annotation._id}
                            checked={
                              annotation.answers?.find(
                                (ans) =>
                                  ans.name ===
                                  (document.cookie
                                    .split("; ")
                                    .find((row) => row.startsWith("username="))
                                    ?.split("=")[1] || "Anonymous")
                              )?.content?.[0] === option
                            }
                            onChange={() => {
                              const username =
                                document.cookie
                                  .split("; ")
                                  .find((row) => row.startsWith("username="))
                                  ?.split("=")[1] || "Anonymous";

                              setConversation((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      annotations: prev.annotations?.map((a) =>
                                        a._id === annotation._id
                                          ? {
                                              ...a,
                                              answers: a.answers
                                                ? a.answers.some(
                                                    (ans) =>
                                                      ans.name === username
                                                  )
                                                  ? a.answers.map((ans) =>
                                                      ans.name === username
                                                        ? {
                                                            ...ans,
                                                            content: [option],
                                                          }
                                                        : ans
                                                    )
                                                  : [
                                                      ...a.answers,
                                                      {
                                                        _id: new Date().toISOString(),
                                                        name: username,
                                                        timestamp: Date.now(),
                                                        content: [option],
                                                      },
                                                    ]
                                                : [
                                                    {
                                                      _id: new Date().toISOString(),
                                                      name: username,
                                                      timestamp: Date.now(),
                                                      content: [option],
                                                    },
                                                  ],
                                            }
                                          : a
                                      ),
                                    }
                                  : null
                              );

                              handleSaveAnswer(annotation._id, [option]);

                            }}
                            onBlur={() =>
                              handleSaveAnswer(annotation._id, [option])
                            }
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {annotation.type === "multiple answers" && (
                    <div className="flex flex-col">
                      {annotation.options?.map((option, index) => (
                        <label
                          key={index}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            checked={annotation.answers
                              ?.find(
                                (ans) =>
                                  ans.name ===
                                  (document.cookie
                                    .split("; ")
                                    .find((row) => row.startsWith("username="))
                                    ?.split("=")[1] || "Anonymous")
                              )
                              ?.content?.includes(option)}
                            onChange={(e) => {
                              const username =
                                document.cookie
                                  .split("; ")
                                  .find((row) => row.startsWith("username="))
                                  ?.split("=")[1] || "Anonymous";

                              setConversation((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      annotations: prev.annotations?.map((a) =>
                                        a._id === annotation._id
                                          ? {
                                              ...a,
                                              answers: a.answers
                                                ? a.answers.some(
                                                    (ans) =>
                                                      ans.name === username
                                                  )
                                                  ? a.answers.map((ans) =>
                                                      ans.name === username
                                                        ? {
                                                            ...ans,
                                                            content: e.target
                                                              .checked
                                                              ? [
                                                                  ...(ans.content ||
                                                                    []),
                                                                  option,
                                                                ]
                                                              : (
                                                                  ans.content ||
                                                                  []
                                                                ).filter(
                                                                  (opt) =>
                                                                    opt !==
                                                                    option
                                                                ),
                                                          }
                                                        : ans
                                                    )
                                                  : [
                                                      ...a.answers,
                                                      {
                                                        _id: new Date().toISOString(),
                                                        name: username,
                                                        timestamp: Date.now(),
                                                        content: e.target
                                                          .checked
                                                          ? [option]
                                                          : [],
                                                      },
                                                    ]
                                                : [
                                                    {
                                                      _id: new Date().toISOString(),
                                                      name: username,
                                                      timestamp: Date.now(),
                                                      content: e.target.checked
                                                        ? [option]
                                                        : [],
                                                    },
                                                  ],
                                            }
                                          : a
                                      ),
                                    }
                                  : null
                              );

                              const updatedContent =
                                annotation.answers
                                  ?.find(
                                    (ans) =>
                                      ans.name ===
                                      (document.cookie
                                        .split("; ")
                                        .find((row) =>
                                          row.startsWith("username=")
                                        )
                                        ?.split("=")[1] || "Anonymous")
                                  )
                                  ?.content?.filter(
                                    (ansOpt) => ansOpt !== option
                                  ) || [];
                              handleSaveAnswer(
                                annotation._id,
                                e.target.checked
                                  ? [...updatedContent, option]
                                  : updatedContent
                              );
                            }}
                            onBlur={(e) => {
                              const updatedContent =
                                annotation.answers
                                  ?.find(
                                    (ans) =>
                                      ans.name ===
                                      (document.cookie
                                        .split("; ")
                                        .find((row) =>
                                          row.startsWith("username=")
                                        )
                                        ?.split("=")[1] || "Anonymous")
                                  )
                                  ?.content?.filter(
                                    (ansOpt) => ansOpt !== option
                                  ) || [];
                              handleSaveAnswer(
                                annotation._id,
                                e.target.checked
                                  ? [...updatedContent, option]
                                  : updatedContent
                              );
                            }}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {annotation.type === "scaler" && (
                    <div className="flex items-center space-x-4">
                      <input
                        type="range"
                        className="w-full accent-primary"
                        min={annotation.options?.[0] || "1"}
                        max={annotation.options?.[1] || "10"}
                        step={annotation.options?.[2] || "1"}
                        value={
                          annotation.answers?.find(
                            (ans) =>
                              ans.name ===
                              (document.cookie
                                .split("; ")
                                .find((row) => row.startsWith("username="))
                                ?.split("=")[1] || "Anonymous")
                          )?.content?.[0] || annotation.options?.[0]
                        }
                        onChange={(e) => {
                          const username =
                            document.cookie
                              .split("; ")
                              .find((row) => row.startsWith("username="))
                              ?.split("=")[1] || "Anonymous";

                          setConversation((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  annotations: prev.annotations?.map((a) =>
                                    a._id === annotation._id
                                      ? {
                                          ...a,
                                          answers: a.answers
                                            ? a.answers.some(
                                                (ans) => ans.name === username
                                              )
                                              ? a.answers.map((ans) =>
                                                  ans.name === username
                                                    ? {
                                                        ...ans,
                                                        content: [
                                                          e.target.value,
                                                        ],
                                                      }
                                                    : ans
                                                )
                                              : [
                                                  ...a.answers,
                                                  {
                                                    _id: new Date().toISOString(),
                                                    name: username,
                                                    timestamp: Date.now(),
                                                    content: [e.target.value],
                                                  },
                                                ]
                                            : [
                                                {
                                                  _id: new Date().toISOString(),
                                                  name: username,
                                                  timestamp: Date.now(),
                                                  content: [e.target.value],
                                                },
                                              ],
                                        }
                                      : a
                                  ),
                                }
                              : null
                          );

                          handleSaveAnswer(annotation._id, [e.target.value]);
                        }}
                        onBlur={(e) =>
                          handleSaveAnswer(annotation._id, [e.target.value])
                        }
                      />
                      <span className="text-foreground font-semibold">
                        {annotation.answers?.find(
                          (ans) =>
                            ans.name ===
                            (document.cookie
                              .split("; ")
                              .find((row) => row.startsWith("username="))
                              ?.split("=")[1] || "Anonymous")
                        )?.content?.[0] || annotation.options?.[0]}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Conversations</h1>
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
                message.role === "user" ? "text-muted" : "text-muted-foreground"
              }`}
            >
              {message.role === "user" ? "You" : "AI"}
            </p>
            <p className="mt-2 leading-relaxed">{message.content}</p>
            <button
              className="bg-yellow-200 rounded-md p-2 text-black mt-2 hover:bg-yellow-300 ease-in-out transition duration-300"
              onClick={() => {
                setActiveMessageIndex(
                  activeMessageIndex === index ? null : index
                );
                setMessageAnnotation(message.annotations || []);
              }}
            >
              {activeMessageIndex === index
                ? "Hide Annotations"
                : "Show Annotations"}
            </button>
            {activeMessageIndex === index && (
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
                      style={{ width: "60%" }}
                    >
                      Answer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {messageAnnotation.map((annotation) => (
                    <tr key={annotation._id} className="even:bg-secondary">
                      <td className="py-2 px-4 border border-muted">
                        {annotation.title}
                      </td>
                      <td className="py-2 px-4 border border-muted">
                        {annotation.type === "textbox" && (
                          <textarea
                            className="w-full p-2 border border-muted rounded-md bg-card text-card-foreground resize-none"
                            value={
                              annotation.answers?.find(
                                (ans) =>
                                  ans.name ===
                                  (document.cookie
                                    .split("; ")
                                    .find((row) => row.startsWith("username="))
                                    ?.split("=")[1] || "Anonymous")
                              )?.content?.[0] || ""
                            }
                            onChange={(e) => {
                              const username =
                                document.cookie
                                  .split("; ")
                                  .find((row) => row.startsWith("username="))
                                  ?.split("=")[1] || "Anonymous";

                              setMessageAnnotation((prev) =>
                                prev.map((a) =>
                                  a._id === annotation._id
                                    ? {
                                        ...a,
                                        answers: a.answers
                                          ? a.answers.some(
                                              (ans) => ans.name === username
                                            )
                                            ? a.answers.map((ans) =>
                                                ans.name === username
                                                  ? {
                                                      ...ans,
                                                      content: [e.target.value],
                                                    }
                                                  : ans
                                              )
                                            : [
                                                ...a.answers,
                                                {
                                                  _id: new Date().toISOString(),
                                                  name: username,
                                                  timestamp: Date.now(),
                                                  content: [e.target.value],
                                                },
                                              ]
                                          : [
                                              {
                                                _id: new Date().toISOString(),
                                                name: username,
                                                timestamp: Date.now(),
                                                content: [e.target.value],
                                              },
                                            ],
                                      }
                                    : a
                                )
                              );

                              handleSaveMessageAnnotation(annotation._id, [
                                e.target.value,
                              ]);
                            }}
                            onBlur={(e) =>
                              handleSaveMessageAnnotation(annotation._id, [
                                e.target.value,
                              ])
                            }
                            rows={3}
                            wrap="soft"
                            placeholder="Type your answer here..."
                          ></textarea>
                        )}

                        {annotation.type === "multiple choice" && (
                          <div className="flex flex-col">
                            {annotation.options?.map((option, idx) => (
                              <label
                                key={idx}
                                className="flex items-center space-x-2"
                              >
                                <input
                                  type="radio"
                                  name={annotation._id}
                                  checked={
                                    annotation.answers?.find(
                                      (ans) =>
                                        ans.name ===
                                        (document.cookie
                                          .split("; ")
                                          .find((row) =>
                                            row.startsWith("username=")
                                          )
                                          ?.split("=")[1] || "Anonymous")
                                    )?.content?.[0] === option
                                  }
                                  onChange={() => {
                                    const username =
                                      document.cookie
                                        .split("; ")
                                        .find((row) =>
                                          row.startsWith("username=")
                                        )
                                        ?.split("=")[1] || "Anonymous";

                                    setMessageAnnotation((prev) =>
                                      prev.map((a) =>
                                        a._id === annotation._id
                                          ? {
                                              ...a,
                                              answers: a.answers
                                                ? a.answers.some(
                                                    (ans) =>
                                                      ans.name === username
                                                  )
                                                  ? a.answers.map((ans) =>
                                                      ans.name === username
                                                        ? {
                                                            ...ans,
                                                            content: [option],
                                                          }
                                                        : ans
                                                    )
                                                  : [
                                                      ...a.answers,
                                                      {
                                                        _id: new Date().toISOString(),
                                                        name: username,
                                                        timestamp: Date.now(),
                                                        content: [option],
                                                      },
                                                    ]
                                                : [
                                                    {
                                                      _id: new Date().toISOString(),
                                                      name: username,
                                                      timestamp: Date.now(),
                                                      content: [option],
                                                    },
                                                  ],
                                            }
                                          : a
                                      )
                                    );

                                    handleSaveMessageAnnotation(
                                      annotation._id,
                                      [option]
                                    );

                                  }}
                                  onBlur={() =>
                                    handleSaveMessageAnnotation(
                                      annotation._id,
                                      [option]
                                    )
                                  }
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {annotation.type === "multiple answers" && (
                          <div className="flex flex-col">
                            {annotation.options?.map((option, idx) => (
                              <label
                                key={idx}
                                className="flex items-center space-x-2"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    annotation.answers
                                      ?.find(
                                        (ans) =>
                                          ans.name ===
                                          (document.cookie
                                            .split("; ")
                                            .find((row) =>
                                              row.startsWith("username=")
                                            )
                                            ?.split("=")[1] || "Anonymous")
                                      )
                                      ?.content?.includes(option) || false
                                  }
                                  onChange={(e) => {
                                    const username =
                                      document.cookie
                                        .split("; ")
                                        .find((row) =>
                                          row.startsWith("username=")
                                        )
                                        ?.split("=")[1] || "Anonymous";

                                    setMessageAnnotation((prev) =>
                                      prev.map((a) =>
                                        a._id === annotation._id
                                          ? {
                                              ...a,
                                              answers: a.answers
                                                ? a.answers.some(
                                                    (ans) =>
                                                      ans.name === username
                                                  )
                                                  ? a.answers.map((ans) =>
                                                      ans.name === username
                                                        ? {
                                                            ...ans,
                                                            content: e.target
                                                              .checked
                                                              ? ans.content?.includes(
                                                                  option
                                                                )
                                                                ? ans.content
                                                                : [
                                                                    ...(ans.content ||
                                                                      []),
                                                                    option,
                                                                  ]
                                                              : (
                                                                  ans.content ||
                                                                  []
                                                                ).filter(
                                                                  (ansOpt) =>
                                                                    ansOpt !==
                                                                    option
                                                                ),
                                                          }
                                                        : ans
                                                    )
                                                  : [
                                                      ...a.answers,
                                                      {
                                                        _id: new Date().toISOString(),
                                                        name: username,
                                                        timestamp: Date.now(),
                                                        content: e.target
                                                          .checked
                                                          ? [option]
                                                          : [],
                                                      },
                                                    ]
                                                : [
                                                    {
                                                      _id: new Date().toISOString(),
                                                      name: username,
                                                      timestamp: Date.now(),
                                                      content: e.target.checked
                                                        ? [option]
                                                        : [],
                                                    },
                                                  ],
                                            }
                                          : a
                                      )
                                    );

                                    const updatedContent = e.target.checked
                                      ? [
                                          ...(annotation.answers?.find(
                                            (ans) =>
                                              ans.name ===
                                              (document.cookie
                                                .split("; ")
                                                .find((row) =>
                                                  row.startsWith("username=")
                                                )
                                                ?.split("=")[1] || "Anonymous")
                                          )?.content || []),
                                          option,
                                        ]
                                      : (
                                          annotation.answers?.find(
                                            (ans) =>
                                              ans.name ===
                                              (document.cookie
                                                .split("; ")
                                                .find((row) =>
                                                  row.startsWith("username=")
                                                )
                                                ?.split("=")[1] || "Anonymous")
                                          )?.content || []
                                        ).filter((ansOpt) => ansOpt !== option);

                                    handleSaveMessageAnnotation(
                                      annotation._id,
                                      updatedContent
                                    );
                                  }}
                                  onBlur={(e) => {
                                    const updatedContent = e.target.checked
                                      ? [
                                          ...(annotation.answers?.find(
                                            (ans) =>
                                              ans.name ===
                                              (document.cookie
                                                .split("; ")
                                                .find((row) =>
                                                  row.startsWith("username=")
                                                )
                                                ?.split("=")[1] || "Anonymous")
                                          )?.content || []),
                                          option,
                                        ]
                                      : (
                                          annotation.answers?.find(
                                            (ans) =>
                                              ans.name ===
                                              (document.cookie
                                                .split("; ")
                                                .find((row) =>
                                                  row.startsWith("username=")
                                                )
                                                ?.split("=")[1] || "Anonymous")
                                          )?.content || []
                                        ).filter((ansOpt) => ansOpt !== option);

                                    handleSaveMessageAnnotation(
                                      annotation._id,
                                      updatedContent
                                    );
                                  }}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {annotation.type === "scaler" && (
                          <div className="flex items-center space-x-4">
                            <input
                              type="range"
                              className="w-full accent-primary"
                              min={annotation.options?.[0] || "1"}
                              max={annotation.options?.[1] || "10"}
                              step={annotation.options?.[2] || "1"}
                              value={
                                annotation.answers?.find(
                                  (ans) =>
                                    ans.name ===
                                    (document.cookie
                                      .split("; ")
                                      .find((row) =>
                                        row.startsWith("username=")
                                      )
                                      ?.split("=")[1] || "Anonymous")
                                )?.content?.[0] || annotation.options?.[0]
                              }
                              onChange={(e) => {
                                const username =
                                  document.cookie
                                    .split("; ")
                                    .find((row) => row.startsWith("username="))
                                    ?.split("=")[1] || "Anonymous";

                                setMessageAnnotation((prev) =>
                                  prev.map((a) =>
                                    a._id === annotation._id
                                      ? {
                                          ...a,
                                          answers: a.answers
                                            ? a.answers.some(
                                                (ans) => ans.name === username
                                              )
                                              ? a.answers.map((ans) =>
                                                  ans.name === username
                                                    ? {
                                                        ...ans,
                                                        content: [
                                                          e.target.value,
                                                        ],
                                                      }
                                                    : ans
                                                )
                                              : [
                                                  ...a.answers,
                                                  {
                                                    _id: new Date().toISOString(),
                                                    name: username,
                                                    timestamp: Date.now(),
                                                    content: [e.target.value],
                                                  },
                                                ]
                                            : [
                                                {
                                                  _id: new Date().toISOString(),
                                                  name: username,
                                                  timestamp: Date.now(),
                                                  content: [e.target.value],
                                                },
                                              ],
                                        }
                                      : a
                                  )
                                );

                                handleSaveMessageAnnotation(annotation._id, [
                                  e.target.value,
                                ]);
                              }}
                              onBlur={(e) =>
                                handleSaveMessageAnnotation(annotation._id, [
                                  e.target.value,
                                ])
                              }
                            />
                            <span className="text-foreground font-semibold">
                              {annotation.answers?.find(
                                (ans) =>
                                  ans.name ===
                                  (document.cookie
                                    .split("; ")
                                    .find((row) => row.startsWith("username="))
                                    ?.split("=")[1] || "Anonymous")
                              )?.content?.[0] || annotation.options?.[0]}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-2">
              <h2 className="text-lg font-semibold text-foreground">
                Comments
              </h2>
              <h4>Refresh after each comments addition</h4>
              {message.comments
                ?.filter((comment) => {
                  const cookieValue = document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("username="))
                    ?.split("=")[1];
                  const username = cookieValue
                    ? decodeURIComponent(cookieValue)
                    : "Anonymous";
                  return comment.name === username;
                })
                .map((comment) => (
                  <div
                    key={comment._id}
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
                    <button
                      className="text-red-500 hover:text-red-600 transition duration-300 font-medium"
                      onClick={() => handleDeleteComment(index, comment._id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}

              <div className="flex items-center mt-4">
                <input
                  type="text"
                  className="w-full p-2 border border-muted rounded-l-md bg-card text-card-foreground focus:outline-none"
                  value={localCommentContent[index] || ""}
                  onChange={(e) =>
                    setLocalCommentContent((prev) => ({
                      ...prev,
                      [index]: e.target.value,
                    }))
                  }
                  placeholder="Type your comment here..."
                />
                <button
                  className="bg-blue-500 text-primary-foreground p-2 rounded-r-md hover:bg-primary-dark transition duration-300"
                  onClick={() => {
                    handleAddComment(index, localCommentContent[index] || "");
                    setLocalCommentContent((prev) => ({
                      ...prev,
                      [index]: "",
                    }));
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
