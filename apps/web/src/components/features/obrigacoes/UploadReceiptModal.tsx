"use client";

import React, { useState, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Textarea,
} from "@heroui/react";
import { UploadIcon, FileIcon, XIcon, CheckIcon } from "@/lib/icons";

interface UploadReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, notes?: string) => Promise<void>;
  obligationName: string;
  clientName: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

export function UploadReceiptModal({
  isOpen,
  onClose,
  onUpload,
  obligationName,
  clientName,
}: UploadReceiptModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return "Tipo de arquivo não suportado. Use PDF, JPEG ou PNG.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Arquivo muito grande. Tamanho máximo: 10MB.";
    }
    return null;
  };

  const handleFile = useCallback((selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      setPreview(null);
      return;
    }

    setError(null);
    setFile(selectedFile);

    // Criar preview para imagens
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    },
    [handleFile]
  );

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Selecione um arquivo para fazer upload.");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      await onUpload(file, notes.trim() || undefined);

      // Reset and close
      setFile(null);
      setNotes("");
      setPreview(null);
      onClose();
    } catch (err) {
      console.error("Erro ao fazer upload:", err);

      // Extract error message from API error
      let errorMessage = "Erro ao fazer upload";
      if (err instanceof Error) {
        errorMessage = err.message;
        // Check if error has data property (from API)
        if ((err as any).data?.detail) {
          errorMessage = (err as any).data.detail;
        }
      } else if (typeof err === "string") {
        errorMessage = err;
      }

      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFile(null);
      setNotes("");
      setPreview(null);
      setError(null);
      onClose();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Anexar Comprovante</h2>
          <div className="text-sm font-normal text-default-500">
            <p>{obligationName}</p>
            <p className="text-xs">{clientName}</p>
          </div>
        </ModalHeader>

        <ModalBody>
          {/* Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-default-300 hover:border-default-400"
            } ${file ? "bg-default-50" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={handleChange}
              disabled={isUploading}
            />

            {!file ? (
              <label htmlFor="file-upload" className="cursor-pointer">
                <UploadIcon className="mx-auto h-12 w-12 text-default-400 mb-4" />
                <p className="text-lg font-medium text-default-700 mb-2">
                  Arraste o arquivo aqui ou clique para selecionar
                </p>
                <p className="text-sm text-default-500">
                  PDF, JPEG ou PNG (máximo 10MB)
                </p>
              </label>
            ) : (
              <div className="flex items-start gap-4">
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-24 h-24 object-cover rounded-lg border border-default-200"
                  />
                ) : (
                  <div className="w-24 h-24 flex items-center justify-center bg-danger-50 rounded-lg border border-danger-200">
                    <FileIcon className="h-12 w-12 text-danger-500" />
                  </div>
                )}
                <div className="flex-1 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-default-900 break-all">
                        {file.name}
                      </p>
                      <p className="text-sm text-default-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={handleRemoveFile}
                      disabled={isUploading}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-success-600">
                    <CheckIcon className="h-4 w-4" />
                    <span className="text-sm">Arquivo válido</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-sm text-danger-700">{error}</p>
            </div>
          )}

          {/* Notes Field */}
          <Textarea
            label="Observações (opcional)"
            placeholder="Adicione observações sobre este comprovante..."
            value={notes}
            onValueChange={setNotes}
            minRows={3}
            maxRows={6}
            disabled={isUploading}
            classNames={{
              input: "resize-y",
            }}
          />
        </ModalBody>

        <ModalFooter>
          <Button
            variant="light"
            onPress={handleClose}
            disabled={isUploading}
          >
            Cancelar
          </Button>
          <Button
            color="primary"
            onPress={handleUpload}
            isLoading={isUploading}
            isDisabled={!file || isUploading}
            startContent={!isUploading && <CheckIcon className="h-4 w-4" />}
          >
            {isUploading ? "Enviando..." : "Confirmar Baixa"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
