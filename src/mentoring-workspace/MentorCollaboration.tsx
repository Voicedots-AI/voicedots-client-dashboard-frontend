import { useMemo } from "react";
import { collegeApi, collegeError } from "../api/collegeApi";
import ConnectedMentoringWorkspace, {
  type WorkspaceTransport,
} from "./ConnectedMentoringWorkspace";
import MentoringWorkspace, { type WorkspaceData } from "./MentoringWorkspace";
export default function MentorCollaboration({
  mentorId,
  demo,
  onMentees,
  onReports,
  activeView,
  onViewChange,
}: {
  mentorId: string;
  demo: boolean;
  onMentees: () => void;
  onReports?: () => void;
  activeView?: string;
  onViewChange?: (view: string) => void;
}) {
  const transport = useMemo<WorkspaceTransport>(
    () => ({
      load: (signal) =>
        collegeApi.get<WorkspaceData>(
          `mentors/workspace${mentorId !== "all" ? `?mentor=${encodeURIComponent(mentorId)}` : ""}`,
          signal,
        ),
      save: (payload) => collegeApi.save("mentors/workspace/actions", payload),
      download: async (file) => {
        if (!file.downloadPath) throw new Error("Attachment unavailable.");
        const blob = await collegeApi.file(
          `mentors/workspace/${file.downloadPath}`,
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: collegeError,
    }),
    [mentorId],
  );
  if (import.meta.env.DEV && demo)
    return (
      <MentoringWorkspace
        demo
        role="mentor"
        onMentees={onMentees}
        onReports={onReports}
      />
    );
  return (
    <ConnectedMentoringWorkspace
      key={mentorId}
      activeView={activeView}
      onViewChange={onViewChange}
      transport={transport}
      onMentees={onMentees}
      onReports={onReports}
    />
  );
}
