"use client";

import { ReportDownloads } from "@/components/features/relatorios/ReportDownloads";
import { Card, CardBody } from "@/heroui";

export default function DownloadsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Downloads</h1>
          <p className="text-default-500 mt-1">
            Relatórios gerados disponíveis para download.
          </p>
        </div>
      </div>
      <ReportDownloads onEdit={() => {}} />
    </div>
  );
}
