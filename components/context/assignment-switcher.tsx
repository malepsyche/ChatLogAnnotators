import { useAssignment } from "@/components/context/assignment-context";

const AssignmentSwitcher = () => {
  const { activeAssignment, assignments, switchAssignment } = useAssignment();

  return (
    <div className="flex items-center space-x-2">
      <label
        htmlFor="assignmentSwitcher"
        className="text-sm font-medium text-foreground"
      >
        Active Assignment:
      </label>
      <select
        id="assignmentSwitcher"
        value={activeAssignment || ""}
        onChange={(e) => void switchAssignment(e.target.value)}
        className="border border-muted focus:ring-primary focus:border-primary rounded-md p-2 bg-secondary text-secondary-foreground"
      >
        <option value="">Select an assignment</option>
        {assignments.map((assignment) => (
          <option
            key={assignment.assignmentId}
            value={assignment.assignmentId}
          >
            {assignment.assignmentTitle}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AssignmentSwitcher;