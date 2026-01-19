"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Switch, Tabs, Tab, Input } from "@/heroui";
import { FinanceiroEscritorio } from "./FinanceiroEscritorio";
import { FinanceiroPorEmpresa } from "./FinanceiroPorEmpresa";
import { FinanceiroLancamentos } from "./FinanceiroLancamentos";
import { pageTransition, fadeIn } from "@/lib/animations";
import { Download } from "lucide-react";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { ReportFormat, ReportType } from "@/types/report";
import { reportsApi } from "@/lib/api/endpoints/reports";
import { toast } from "@/lib/toast";
import { formatISO, startOfMonth } from "date-fns";
import { useAuth } from "@/hooks/auth/AuthContext";
import { clientsApi } from "@/lib/api/endpoints/clients";
import type { ClientListItem } from "@/types/client";

type ExportScope = "office" | "client";

export function FinanceiroModule() {
  const { user } = useAuth();
  const isAdminOrFunc = user?.role !== "cliente";
  const OFFICE_CLIENT_ID = process.env.NEXT_PUBLIC_OFFICE_CLIENT_ID ?? "";
  const [activeTab, setActiveTab] = useState("escritorio");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [rangeStart, setRangeStart] = useState(formatISO(startOfMonth(new Date()), { representation: "date" }));
  const [rangeEnd, setRangeEnd] = useState(formatISO(new Date(), { representation: "date" }));
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>(ReportFormat.PDF);
  const [clientSearch, setClientSearch] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientListItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientForExport, setSelectedClientForExport] = useState<ClientListItem | null>(null);
  const [isOfficeExport, setIsOfficeExport] = useState(true);

  useEffect(() => {
    if (!isAdminOrFunc || !isExportOpen) return;
    let active = true;
    (async () => {
      try {
        const res = await clientsApi.list({ query: clientSearch || undefined, size: 20 });
        if (active) {
          setClientOptions((prev) => {
            if (!selectedClientForExport) return res.items;
            const exists = res.items.some((client) => client.id === selectedClientForExport.id);
            return exists ? res.items : [selectedClientForExport, ...res.items];
          });
        }
      } catch (error) {
        console.error("Erro ao buscar clientes para exportação", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [clientSearch, isAdminOrFunc, isExportOpen, selectedClientForExport]);

  const openExportModal = (scope: ExportScope, client?: ClientListItem | null) => {
    const office = scope === "office";
    const resolvedClient = office ? null : client ?? selectedClientForExport;
    setIsOfficeExport(office);
    if (office) {
      setSelectedClientId(null);
      setClientSearch("");
    } else if (resolvedClient) {
      setSelectedClientForExport(resolvedClient);
      setSelectedClientId(resolvedClient.id);
      setClientSearch(resolvedClient.nome_fantasia || resolvedClient.razao_social);
      setClientOptions((prev) => {
        const exists = prev.some((item) => item.id === resolvedClient.id);
        return exists ? prev : [resolvedClient, ...prev];
      });
    } else {
      setSelectedClientForExport(null);
      setSelectedClientId(null);
      setClientSearch("");
    }
    setIsExportOpen(true);
  };

  const handleExport = async () => {
    if (rangeStart > rangeEnd) {
      toast.error("A data inicial deve ser anterior à data final.");
      return;
    }

    let clientIds: string[] | undefined = undefined;
    if (isAdminOrFunc) {
      if (isOfficeExport) {
        if (!OFFICE_CLIENT_ID) {
          toast.error("Configure o ID do escritório (NEXT_PUBLIC_OFFICE_CLIENT_ID) para exportar o Livro Caixa.");
          return;
        }
        clientIds = [OFFICE_CLIENT_ID];
      } else if (selectedClientId) {
        clientIds = [selectedClientId];
      } else {
        toast.error("Selecione um cliente para exportar o Livro Caixa.");
        return;
      }
    }

    try {
      setIsExporting(true);
      const response = await reportsApi.exportReport({
        report_type: ReportType.LIVRO_CAIXA,
        format: selectedFormat,
        filters: {
          period_start: rangeStart,
          period_end: rangeEnd,
          report_type: ReportType.LIVRO_CAIXA,
          client_ids: clientIds,
        },
        customizations: {
          include_summary: true,
          include_charts: false,
        },
        filename: `livro_caixa-${rangeEnd}`,
      });

      const { blob, filename } = await reportsApi.downloadReport(response.report_id, response.file_name);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Livro Caixa exportado com sucesso.");
      setIsExportOpen(false);
    } catch (error) {
      console.error("Erro ao exportar Livro Caixa", error);
      toast.error("Não foi possível exportar o Livro Caixa.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
      className="space-y-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel Financeiro — Livro-Caixa</h1>
          <p className="text-default-500 mt-1">Gestão completa de receitas, despesas e análises financeiras</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="flat"
            startContent={<Download className="h-4 w-4" />}
            onPress={() =>
              openExportModal(
                activeTab === "por-empresa" ? "client" : "office",
                activeTab === "por-empresa" ? selectedClientForExport : null
              )
            }
          >
            Exportar Livro Caixa
          </Button>
        </div>
      </div>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        color="primary"
      >
        <Tab key="escritorio" title="Escritório">
          <motion.div
            key="escritorio"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeIn}
            className="mt-6"
          >
            <FinanceiroEscritorio onExportLivro={() => openExportModal("office")} />
          </motion.div>
        </Tab>
        <Tab key="por-empresa" title="Por Empresa">
          <motion.div
            key="por-empresa"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeIn}
            className="mt-6"
          >
            <FinanceiroPorEmpresa
              onExportLivro={(client) => openExportModal("client", client ?? null)}
              onClientChange={setSelectedClientForExport}
            />
          </motion.div>
        </Tab>
        <Tab key="lancamentos" title="Lançamentos">
          <motion.div
            key="lancamentos"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeIn}
            className="mt-6"
          >
            <FinanceiroLancamentos />
          </motion.div>
        </Tab>
      </Tabs>

      <Modal isOpen={isExportOpen} onOpenChange={(open) => setIsExportOpen(open)}>
        <ModalContent>
          <ModalHeader>Exportar Livro Caixa</ModalHeader>
          <ModalBody className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <DatePickerField
                label="Início"
                value={rangeStart}
                onChange={setRangeStart}
                size="md"
                className="flex-1"
                aria-label="Data de início"
              />
              <DatePickerField
                label="Fim"
                value={rangeEnd}
                onChange={setRangeEnd}
                size="md"
                className="flex-1"
                aria-label="Data de fim"
              />
            </div>
            <Select
              label="Formato"
              selectedKeys={[selectedFormat]}
              onSelectionChange={(keys) => {
                const key = Array.from(keys)[0] as ReportFormat;
                if (key) setSelectedFormat(key);
              }}
            >
              <SelectItem key={ReportFormat.PDF}>
                PDF
              </SelectItem>
              <SelectItem key={ReportFormat.CSV}>
                CSV
              </SelectItem>
              <SelectItem key={ReportFormat.XLS}>
                XLS
              </SelectItem>
            </Select>
            {isAdminOrFunc && (
              <div className="space-y-3">
                <Switch
                  isSelected={isOfficeExport}
                  onValueChange={(v) => {
                    setIsOfficeExport(v);
                    if (v) setSelectedClientId(null);
                  }}
                >
                  Exportar Livro do escritório
                </Switch>
                {!isOfficeExport && (
                  <div className="space-y-2">
                    <Input
                      label="Cliente"
                      placeholder="Buscar por nome/razão social"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                    />
                    <Select
                      label="Selecionar cliente"
                      selectedKeys={selectedClientId ? [selectedClientId] : []}
                      onSelectionChange={(keys) => {
                        const key = Array.from(keys)[0] as string;
                        setSelectedClientId(key || null);
                        setIsOfficeExport(false);
                      }}
                    >
                      {clientOptions.map((client) => (
                        <SelectItem key={client.id}>
                          {client.nome_fantasia || client.razao_social}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsExportOpen(false)}>
              Cancelar
            </Button>
            <Button color="primary" onPress={handleExport} isLoading={isExporting}>
              Exportar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
