"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Divider,
  Chip,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
} from "@/heroui";
import { useAuth } from "@/hooks/auth/useAuth";

interface ClientObligation {
  id: string;
  obligation_type_name: string;
  obligation_type_code: string;
  status: "pending" | "completed" | "cancelled";
  due_date: string;
  completed_at?: string;
  receipt_url?: string;
  description?: string;
}

export default function PortalObrigacoesPage() {
  const { user } = useAuth();
  const [obligations, setObligations] = useState<ClientObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedObligation, setSelectedObligation] =
    useState<ClientObligation | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const {
    isOpen: isDetailsOpen,
    onOpen: onDetailsOpen,
    onClose: onDetailsClose,
  } = useDisclosure();

  useEffect(() => {
    if (user) {
      fetchObligations();
    }
  }, [user]);

  const fetchObligations = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("access_token");

      // Get client ID first (in production, this would come from the user profile)
      // For now, we'll assume the API handles this based on the authenticated user
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/obligations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch obligations");
      }

      const data = await response.json();
      setObligations(data.items || []);
    } catch (error) {
      console.error("Error fetching obligations:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "pending":
        return "warning";
      case "cancelled":
        return "danger";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Concluída";
      case "pending":
        return "Pendente";
      case "cancelled":
        return "Cancelada";
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status !== "pending") return false;
    const due = new Date(dueDate);
    const now = new Date();
    return due < now;
  };

  const filteredObligations = obligations.filter((obligation) => {
    if (filter === "all") return true;
    return obligation.status === filter;
  });

  const stats = {
    total: obligations.length,
    pending: obligations.filter((o) => o.status === "pending").length,
    completed: obligations.filter((o) => o.status === "completed").length,
    overdue: obligations.filter(
      (o) => o.status === "pending" && isOverdue(o.due_date, o.status)
    ).length,
  };

  const handleViewDetails = (obligation: ClientObligation) => {
    setSelectedObligation(obligation);
    onDetailsOpen();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Minhas Obrigações</h1>
        <p className="text-default-500 mt-1">
          Acompanhe suas obrigações fiscais e seus prazos
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-sm text-default-500">Total</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-warning">{stats.pending}</p>
            <p className="text-sm text-default-500">Pendentes</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-success">{stats.completed}</p>
            <p className="text-sm text-default-500">Concluídas</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-danger">{stats.overdue}</p>
            <p className="text-sm text-default-500">Vencidas</p>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "solid" : "flat"}
          color={filter === "all" ? "primary" : "default"}
          onPress={() => setFilter("all")}
        >
          Todas
        </Button>
        <Button
          variant={filter === "pending" ? "solid" : "flat"}
          color={filter === "pending" ? "warning" : "default"}
          onPress={() => setFilter("pending")}
        >
          Pendentes
        </Button>
        <Button
          variant={filter === "completed" ? "solid" : "flat"}
          color={filter === "completed" ? "success" : "default"}
          onPress={() => setFilter("completed")}
        >
          Concluídas
        </Button>
      </div>

      {/* Obligations List */}
      {filteredObligations.length === 0 ? (
        <Card>
          <CardBody className="text-center p-8">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-default-400">Nenhuma obrigação encontrada</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredObligations.map((obligation) => (
            <Card
              key={obligation.id}
              isPressable
              onPress={() => handleViewDetails(obligation)}
              className={
                isOverdue(obligation.due_date, obligation.status)
                  ? "border-2 border-danger"
                  : ""
              }
            >
              <CardHeader className="flex justify-between">
                <div className="flex-1">
                  <p className="font-semibold">
                    {obligation.obligation_type_name}
                  </p>
                  <p className="text-xs text-default-400">
                    {obligation.obligation_type_code}
                  </p>
                </div>
                <Chip
                  color={getStatusColor(obligation.status) as any}
                  size="sm"
                  variant="flat"
                >
                  {getStatusLabel(obligation.status)}
                </Chip>
              </CardHeader>
              <Divider />
              <CardBody>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-default-500">Vencimento</p>
                    <p
                      className={`font-semibold ${
                        isOverdue(obligation.due_date, obligation.status)
                          ? "text-danger"
                          : ""
                      }`}
                    >
                      {formatDate(obligation.due_date)}
                    </p>
                    {isOverdue(obligation.due_date, obligation.status) && (
                      <Chip color="danger" size="sm" className="mt-1">
                        Vencida
                      </Chip>
                    )}
                  </div>

                  {obligation.completed_at && (
                    <div>
                      <p className="text-xs text-default-500">Concluída em</p>
                      <p className="text-sm">
                        {formatDate(obligation.completed_at)}
                      </p>
                    </div>
                  )}

                  {obligation.description && (
                    <div>
                      <p className="text-xs text-default-500">Descrição</p>
                      <p className="text-sm line-clamp-2">
                        {obligation.description}
                      </p>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={onDetailsClose} size="3xl">
        <ModalContent>
          <ModalHeader>Detalhes da Obrigação</ModalHeader>
          <ModalBody>
            {selectedObligation && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-default-500">Obrigação</p>
                    <p className="font-semibold">
                      {selectedObligation.obligation_type_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Código</p>
                    <p className="font-semibold">
                      {selectedObligation.obligation_type_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Vencimento</p>
                    <p className="font-semibold">
                      {formatDate(selectedObligation.due_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Status</p>
                    <Chip
                      color={getStatusColor(selectedObligation.status) as any}
                      variant="flat"
                    >
                      {getStatusLabel(selectedObligation.status)}
                    </Chip>
                  </div>
                </div>

                {selectedObligation.description && (
                  <div>
                    <p className="text-sm text-default-500">Descrição</p>
                    <p>{selectedObligation.description}</p>
                  </div>
                )}

                {selectedObligation.receipt_url && (
                  <div>
                    <p className="text-sm text-default-500 mb-2">Comprovante</p>
                    <Button
                      as="a"
                      href={selectedObligation.receipt_url}
                      target="_blank"
                      color="primary"
                      variant="flat"
                    >
                      Ver Comprovante
                    </Button>
                  </div>
                )}

                <Divider />

                <ObligationTimeline obligationId={selectedObligation.id} />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onDetailsClose}>
              Fechar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
