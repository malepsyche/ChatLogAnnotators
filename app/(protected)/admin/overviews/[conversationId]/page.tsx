"use client";

import { useState, useEffect } from "react";
import { Conversation, Annotation, Message } from "@/types/conversations";

export default function SummaryPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [activeMessageIndices, setActiveMessageIndices] = useState<{
    [index: number]: boolean;
  }>({});
  const [activeCommentIndices, setActiveCommentIndices] = useState<{
    [index: number]: boolean;
  }>({});
  const [hasComments, setHasComments] = useState<{ [key: number]: boolean }>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedToggleAll = localStorage.getItem("toggleAll");
    const toggleAll = storedToggleAll ? JSON.parse(storedToggleAll) : false;
    params
      .then(({ conversationId }) => {
        fetch(`/api/conversations/${conversationId}`)
          .then((res) => {
            if (!res.ok) throw new Error("Failed to fetch conversation");
            return res.json();
          })
          .then((data) => {
            setConversation(data);
            const commentPresence: { [key: number]: boolean } = {};
            data.messages.forEach((message: Message, index: number) => {
              if (message.comments && message.comments.length > 0) {
                commentPresence[index] = message.comments.length > 0;
              }
            });
            setHasComments(commentPresence);
            const indices: { [key: number]: boolean } = {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.messages.forEach((_: any, index: number) => {
              indices[index] = toggleAll;
            });
            setActiveMessageIndices(indices);
            setActiveCommentIndices(indices);
          })
          .catch((error) => {
            console.error("Error fetching conversation:", error);
            setError("Failed to load conversation");
          });
      })
      .catch((error) => {
        console.error("Error resolving params:", error);
        setError("Invalid conversation ID");
      });
  }, [params]);

  if (error) {
    return <p className="text-red-500 p-4">{error}</p>;
  }

  if (!conversation) {
    return (
      <p className="bg-muted text-muted-foreground p-4 w-width">
        Loading conversation summary...
      </p>
    );
  }

  const resolveAnnotation = async (
    annotationId: string,
    answer: string[]
  ) => {
    try {
      const response = await fetch(
        `/api/conversations/${conversation._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: conversation._id,
            annotationId,
            updatedAnswer: answer,
            name: "admin",
            action: "resolve",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to resolve annotation");
      }

      const updatedResponse = await fetch(
        `/api/conversations/${conversation._id}`
      );

      if (!updatedResponse.ok) {
        throw new Error("Failed to refresh conversation");
      }

      const updatedConversation = await updatedResponse.json();
      setConversation(updatedConversation);
    } catch (error) {
      console.error("Error resolving annotation:", error);
    }
  };

  const renderFinalAnnotation = (annotation: Annotation) => {
    if (annotation.resolutionStatus === "pending") {
      return <span>Pending</span>;
    }

    if (annotation.resolutionStatus === "consensus") {
      return (
        <span>
          {annotation.effectiveFinalAnnotation?.join(", ")} (Consensus)
        </span>
      );
    }

    if (
      annotation.resolutionStatus === "disagreement" ||
      annotation.resolutionStatus === "admin-resolved"
    ) {
      return (
        <div>
          {annotation.resolutionStatus === "disagreement" ? (
            <div className="mb-2">
              Disagreement - admin resolution required
            </div>
          ) : (
            <div className="mb-2">
              Current: {annotation.effectiveFinalAnnotation?.join(", ")}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {annotation.options?.map((option) => {
              const isSelected =
                annotation.effectiveFinalAnnotation?.includes(option);

              return (
                <button
                  key={option}
                  onClick={() =>
                    resolveAnnotation(annotation._id, [option])
                  }
                  className={`px-3 py-1 rounded ${
                    isSelected
                      ? "bg-green-500 text-white"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return <span>N/A</span>;
  };

  const renderSummary = (annotation: Annotation) => {
    switch (annotation.type) {
      case "multiple choice": {
        const optionCounts = annotation.options?.map((option) => ({
          option,
          count:
            annotation.answers?.filter(
              (ans) => ans.content && ans.content.includes(option)
            ).length || 0,
        }));

        return (
          <table className="w-full border border-muted-foreground">
            <thead className="bg-secondary border-muted-foreground text-secondary-foreground">
              <tr>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "25%" }}
                >
                  Option
                </th>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "25%" }}
                >
                  Count
                </th>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "25%" }}
                >
                  Details
                </th>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "25%" }}
                >
                  Final Annotation
                </th>
              </tr>
            </thead>

            <tbody>
              {optionCounts?.map(({ option, count }, index) => (
                <tr key={index}>
                  <td className="border border-muted-foreground py-2 px-4">
                    {option}
                  </td>

                  <td className="border border-muted-foreground py-2 px-4">
                    {count}
                  </td>

                  <td className="border border-muted-foreground py-2 px-4">
                    {annotation.answers
                      ?.filter(
                        (ans) => ans.content && ans.content.includes(option)
                      )
                      .map((ans, index) => (
                        <div key={index}>{ans.name}</div>
                      ))}
                  </td>

                  {index === 0 && (
                    <td
                      rowSpan={optionCounts.length}
                      className="border border-muted-foreground py-2 px-4"
                    >
                      {renderFinalAnnotation(annotation)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      case "multiple answers": {
        const optionCounts = annotation.options?.map((option) => ({
          option,
          count:
            annotation.answers?.filter(
              (ans) => ans.content && ans.content.includes(option)
            ).length || 0,
        }));

        return (
          <table className="w-full border border-muted-foreground">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "25%" }}
                >
                  Option
                </th>
                <th
                  className="border border-muted-foreground py-2 px-4 text-center"
                  style={{ width: "25%" }}
                >
                  Count
                </th>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "25%" }}
                >
                  Details
                </th>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "25%" }}
                >
                  Final Annotation
                </th>
              </tr>
            </thead>

            <tbody>
              {optionCounts?.map(({ option, count }, index) => (
                <tr key={index}>
                  <td className="border border-muted-foreground py-2 px-4">
                    {option}
                  </td>

                  <td className="border border-muted-foreground py-2 px-4 text-center">
                    {count}
                  </td>

                  <td className="border border-muted-foreground py-2 px-4">
                    {annotation.answers
                      ?.filter(
                        (ans) => ans.content && ans.content.includes(option)
                      )
                      .map((ans) => ans.name)
                      .join(", ") || "No responses"}
                  </td>

                  {index === 0 && (
                    <td
                      rowSpan={optionCounts.length}
                      className="border border-muted-foreground py-2 px-4"
                    >
                      {renderFinalAnnotation(annotation)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      case "scaler": {
        const values =
          annotation.answers?.map((ans) =>
            ans.content ? parseFloat(ans.content[0]) : NaN
          ) || [];

        const average =
          values.length > 0
            ? (
                values.reduce((sum, val) => sum + val, 0) / values.length
              ).toFixed(2)
            : "N/A";

        return (
          <table className="w-full border border-muted-foreground">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "25%" }}
                >
                  Average
                </th>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "75%" }}
                >
                  Details
                </th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="border border-muted-foreground py-2 px-4 text-center">
                  {average}
                </td>
                <td className="border border-muted-foreground py-2 px-4">
                  {annotation.answers
                    ?.map((ans) =>
                      ans.content
                        ? `${ans.name} (${ans.content[0]})`
                        : `${ans.name} (No content)`
                    )
                    .join(", ") || "No responses"}
                </td>
              </tr>
            </tbody>
          </table>
        );
      }

      case "textbox": {
        return (
          <table className="w-full border border-muted">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="border border-muted-foreground py-2 px-4">
                  Response
                </th>
              </tr>
            </thead>

            <tbody>
              {annotation.answers?.map((ans, index) => (
                <tr key={index}>
                  <td className="border border-muted-foreground py-2 px-4">
                    {ans.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
    }
  };

  const toggleMessageIndex = (index: number) => {
    setActiveMessageIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const toggleCommentIndex = (index: number) => {
    setActiveCommentIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleToggleAll = () => {
    const newToggleAll = !JSON.parse(
      localStorage.getItem("toggleAll") || "false"
    );
    localStorage.setItem("toggleAll", JSON.stringify(newToggleAll));
    const newIndices = Object.keys(activeMessageIndices).reduce<{
      [key: string]: boolean;
    }>((acc, key) => {
      acc[key] = newToggleAll;
      return acc;
    }, {});
    setActiveMessageIndices(newIndices);
    setActiveCommentIndices(newIndices);
  };

  return (
    <div className="p-4 bg-background text-foreground h-screen flex flex-col">
      <button
        onClick={handleToggleAll}
        className="p-2 bg-blue-500 text-white rounded"
      >
        {JSON.parse(localStorage.getItem("toggleAll") || "false")
          ? "Close All Annotations and Comments"
          : "Open All Annotations and Comments"}
      </button>

      <h1 className="text-2xl font-bold mb-4">
        Summary of Annotations Conversation Level
      </h1>

      {conversation.annotationStats && (
        <div className="mb-4">
          <table className="w-full border border-muted-foreground">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "25%" }}
                >
                  Annotation Status
                </th>
                <th
                  className="border border-muted-foreground py-2 px-4 text-center"
                  style={{ width: "25%" }}
                >
                  Count
                </th>
                <th
                  className="border border-muted-foreground py-2 px-4"
                  style={{ width: "50%" }}
                >
                  Annotators
                </th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="border border-muted-foreground py-2 px-4">
                  Not Annotated
                </td>
                <td className="border border-muted-foreground py-2 px-4 text-center">
                  {conversation.annotationStats.notAnnotated}
                </td>
                <td className="border border-muted-foreground py-2 px-4">
                  {conversation.annotationStats.notAnnotatedUsers.length > 0
                    ? conversation.annotationStats.notAnnotatedUsers.join(", ")
                    : "None"}
                </td>
              </tr>

              <tr>
                <td className="border border-muted-foreground py-2 px-4">
                  In Progress
                </td>
                <td className="border border-muted-foreground py-2 px-4 text-center">
                  {conversation.annotationStats.inProgress}
                </td>
                <td className="border border-muted-foreground py-2 px-4">
                  {conversation.annotationStats.inProgressUsers.length > 0
                    ? conversation.annotationStats.inProgressUsers.join(", ")
                    : "None"}
                </td>
              </tr>

              <tr>
                <td className="border border-muted-foreground py-2 px-4">
                  Annotated
                </td>
                <td className="border border-muted-foreground py-2 px-4 text-center">
                  {conversation.annotationStats.annotated}
                </td>
                <td className="border border-muted-foreground py-2 px-4">
                  {conversation.annotationStats.annotatedUsers.length > 0
                    ? conversation.annotationStats.annotatedUsers.join(", ")
                    : "None"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {conversation.annotations?.map((annotation, index) => (
        <div key={index} className="mb-4">
          <h2 className="text-lg font-semibold">{annotation.title}</h2>
          {renderSummary(annotation)}
        </div>
      ))}

      <h1 className="text-2xl font-bold mb-4">
        Summary of Annotations Message Level
      </h1>

      {conversation.messages.map((message, index) => (
        <div
          key={index}
          className={`p-4 rounded-lg w-full mb-3 ${
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
            className="bg-yellow-200 rounded-md p-2 text-black mt-2 hover:bg-yellow-300 ease-in-out transition duration-300 mr-2"
            onClick={() => {
              toggleMessageIndex(index);
            }}
          >
            {activeMessageIndices[index]
              ? "Hide Annotations"
              : "Show Annotations"}
          </button>

          <button
            className={`bg-yellow-200 rounded-md p-2 text-black mt-2 hover:bg-yellow-300 ease-in-out transition duration-300 ${
              hasComments[index] ? "glow-button text-red-600" : ""
            }`}
            onClick={() => {
              toggleCommentIndex(index);
            }}
          >
            {activeCommentIndices[index] ? "Hide Comments" : "Show Comments"}
          </button>

          {activeMessageIndices[index] && (
            <div className="mt-2">
              {message.annotations?.map((annotation, index) => (
                <div key={index} className="mt-2">
                  <h3 className="text-lg font-semibold">{annotation.title}</h3>
                  {renderSummary(annotation)}
                </div>
              ))}
            </div>
          )}

          {activeCommentIndices[index] && (
            <div className="mt-4 space-y-4">
              {message.comments?.map((comment, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {comment.name}
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(comment.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="mt-2 text-gray-800 dark:text-gray-200 leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}