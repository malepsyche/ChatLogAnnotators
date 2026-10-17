"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { toast } from "react-toastify";

interface Assignment {
  assignmentId: string;
  assignmentTitle: string;
  databaseId: string;
  conversationCount: number;
  isLocked: boolean;
}

interface AssignmentContextType {
  activeAssignment: string | null;
  activeDatabase: string | null;
  setActiveAssignment: (assignment: string | null) => void;
  assignments: Assignment[];
  switchAssignment: (assignmentId: string) => Promise<void>;
  refreshAssignments: () => Promise<void>;
}

const AssignmentContext = createContext<AssignmentContextType | undefined>(
  undefined
);

export const useAssignment = () => {
  const context = useContext(AssignmentContext);

  if (!context) {
    throw new Error("useAssignment must be used within an AssignmentProvider");
  }

  return context;
};

export const AssignmentProvider = ({ children }: { children: ReactNode }) => {
  const [activeAssignment, setActiveAssignment] = useState<string | null>(null);
  const [activeDatabase, setActiveDatabase] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const switchAssignment = async (assignmentId: string) => {
    const selectedAssignment = assignments.find(
      (assignment) => assignment.assignmentId === assignmentId
    );

    if (!selectedAssignment) {
      return;
    }

    try {
      const response = await fetch("/api/annotators/databases/switch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignmentId,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to switch assignment");
      }

      const updatedAssignment = await response.json();

      setActiveAssignment(assignmentId);
      setActiveDatabase(updatedAssignment.databaseId);

      sessionStorage.setItem("activeAssignmentId", assignmentId);

      toast.success("Switched assignment successfully");
    } catch (error) {
      console.error("[AssignmentProvider] Error switching assignment:", error);
      toast.error("Failed to switch assignment");
    }
  };

  const refreshAssignments = async () => {
    const username = document.cookie
      .split("; ")
      .find((row) => row.startsWith("username="))
      ?.split("=")[1];

    if (!username) {
      console.error("[AssignmentProvider] Username not found in cookies");
      return;
    }

    try {
      const response = await fetch(
        `/api/annotators/databases?username=${encodeURIComponent(
          decodeURIComponent(username)
        )}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch assignments");
      }

      const data: Assignment[] = await response.json();

      setAssignments(data);

      const storedAssignmentId = sessionStorage.getItem("activeAssignmentId");

      const selectedAssignment =
        data.find((assignment) => assignment.assignmentId === storedAssignmentId) ||
        data[0];

      if (!selectedAssignment) {
        setActiveAssignment(null);
        setActiveDatabase(null);
        sessionStorage.removeItem("activeAssignmentId");
        return;
      }

      const switchResponse = await fetch("/api/annotators/databases/switch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignmentId: selectedAssignment.assignmentId,
        }),
      });

      if (!switchResponse.ok) {
        throw new Error("Failed to restore active assignment");
      }

      const updatedAssignment = await switchResponse.json();

      setActiveAssignment(selectedAssignment.assignmentId);
      setActiveDatabase(updatedAssignment.databaseId);

      sessionStorage.setItem(
        "activeAssignmentId",
        selectedAssignment.assignmentId
      );
    } catch (error) {
      console.error("[AssignmentProvider] Error fetching assignments:", error);
      toast.error("Failed to fetch assignments");
    }
  };

  useEffect(() => {
    void refreshAssignments();
  }, []);

  return (
    <AssignmentContext.Provider
      value={{
        activeAssignment,
        activeDatabase,
        setActiveAssignment,
        assignments,
        switchAssignment,
        refreshAssignments,
      }}
    >
      {children}
    </AssignmentContext.Provider>
  );
};