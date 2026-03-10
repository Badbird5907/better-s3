import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { Badge } from "@app/ui/components/badge";

type FileStatus = "completed" | "pending" | "failed";

interface FileStatusBadgeProps {
  status: FileStatus;
}

export function FileStatusBadge({ status }: FileStatusBadgeProps) {
  if (status === "completed") {
    return (
      <Badge variant="default" className="bg-green-600 text-white hover:bg-green-700">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Completed
      </Badge>
    );
  }

  if (status === "pending") {
    return (
      <Badge variant="secondary" className="bg-yellow-500 text-white hover:bg-yellow-600">
        <Clock className="mr-1 h-3 w-3" />
        Pending
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="bg-red-600 text-white hover:bg-red-700">
      <XCircle className="mr-1 h-3 w-3" />
      Failed
    </Badge>
  );
}
