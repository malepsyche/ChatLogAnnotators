"use client";

import { ReactNode, useEffect, useState } from "react";

interface AnalyticsDashboard {
  annotationPercentage: number;
}

export default function HomeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch analytics");
        return res.json();
      })
      .then((data) => {
        setAnalytics(data);
      })
      .catch((error) => {
        console.error("Error fetching analytics:", error);
      });
  }, []);

  return (
    <div className="h-screen flex flex-row overflow-auto bg-black text-white">
      <div className="overflow-auto p-4">
        Annotation progress:{" "}
        {analytics
          ? `${analytics.annotationPercentage.toFixed(1)}%`
          : "Loading..."}
      </div>

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}