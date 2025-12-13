"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Button } from "@heroui/react";
import { SnippetCopy } from "@/components/ui/SnippetCopy";

interface ClientCreatedSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  access: string;
  credential: string;
}

export function ClientCreatedSuccessModal({
  isOpen,
  onClose,
  access,
  credential,
}: ClientCreatedSuccessModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        {(onCloseModal) => (
          <>
            <ModalHeader className="px-6 pt-6">
              <h2 className="text-xl font-bold">Cliente cadastrado com sucesso</h2>
            </ModalHeader>
            <ModalBody className="px-6 py-4 space-y-4">
              <p className="text-sm text-default-600">
                O usuário do cliente foi gerado. Salve o acesso e a credencial abaixo (a credencial não
                será exibida novamente).
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-default-600">Acesso</span>
                  <SnippetCopy text={access} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-default-600">Credencial</span>
                  <SnippetCopy text={credential} hideByDefault />
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="px-6 pb-6">
              <Button color="primary" onPress={onCloseModal}>
                Fechar
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

