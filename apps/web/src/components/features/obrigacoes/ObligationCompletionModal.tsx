'use client';

import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Textarea,
} from '@/heroui';
import { CheckIcon, UploadIcon } from '@/lib/icons';
import { obligationsApi, type ObligationResponse } from '@/lib/api/endpoints/obligations';

interface ObligationCompletionModalProps {
  obligation: ObligationResponse;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ObligationCompletionModal({
  obligation,
  isOpen,
  onClose,
  onSuccess,
}: ObligationCompletionModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validar tipo e tamanho
      if (!selectedFile.type.match(/^(application\/pdf|image\/(jpeg|jpg|png))$/)) {
        setError('Apenas PDF, JPEG ou PNG são aceitos');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('Arquivo deve ter no máximo 10MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Selecione um arquivo');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await obligationsApi.uploadReceipt(obligation.id, file, notes);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao fazer upload:', err);

      let errorMessage = 'Erro ao fazer upload';
      if (err instanceof Error) {
        errorMessage = err.message;
        if ((err as any).data?.detail) {
          errorMessage = (err as any).data.detail;
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setNotes('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="2xl">
      <ModalContent>
        <ModalHeader>
          <h3 className="text-lg font-semibold">
            Baixar Obrigação: {obligation.obligation_type_name}
          </h3>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* Info da obrigação */}
            <div className="rounded-lg bg-default-100 p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-default-500">Cliente:</span>
                  <span className="ml-2 font-medium">{obligation.client_name}</span>
                </div>
                <div>
                  <span className="text-default-500">CNPJ:</span>
                  <span className="ml-2 font-medium">{obligation.client_cnpj}</span>
                </div>
                <div>
                  <span className="text-default-500">Vencimento:</span>
                  <span className="ml-2 font-medium">
                    {new Date(obligation.due_date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-default-500">Prioridade:</span>
                  <span className="ml-2 font-medium">{obligation.priority}</span>
                </div>
              </div>
            </div>

            {/* Upload de arquivo */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Anexar Comprovante *
              </label>
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-default-300 p-6 transition hover:border-primary">
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="flex cursor-pointer flex-col items-center"
                >
                  <UploadIcon className="mb-2 h-8 w-8 text-default-400" />
                  <span className="text-sm text-default-600">
                    {file ? file.name : 'Clique para selecionar arquivo'}
                  </span>
                  <span className="mt-1 text-xs text-default-400">
                    PDF, JPEG ou PNG (máx. 10MB)
                  </span>
                </label>
              </div>
            </div>

            {/* Observações */}
            <div>
              <Textarea
                label="Observações (opcional)"
                placeholder="Adicione observações sobre a obrigação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </div>

            {/* Erro */}
            {error && (
              <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger">
                {error}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isLoading}>
            Cancelar
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isLoading}
            startContent={!isLoading && <CheckIcon className="h-4 w-4" />}
          >
            Confirmar Baixa
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
