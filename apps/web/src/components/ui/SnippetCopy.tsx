'use client';

import { useState } from 'react';
import { Button, Tooltip } from '@/heroui';
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from '@/lib/icons';

interface SnippetCopyProps {
  text: string;
  label?: string;
  hideByDefault?: boolean;
}

export function SnippetCopy({ text, label, hideByDefault = false }: SnippetCopyProps) {
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(!hideByDefault);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const displayText = isVisible ? (label || text) : '••••••••';

  return (
    <div className="inline-flex items-center gap-1">
      <span className="font-mono text-xs truncate max-w-[120px]" title={text}>{displayText}</span>
      {hideByDefault && (
        <Tooltip content={isVisible ? 'Ocultar' : 'Mostrar'}>
          <Button
            size="sm"
            variant="light"
            isIconOnly
            onPress={toggleVisibility}
            className="min-w-unit-5 h-5 w-5"
          >
            {isVisible ? (
              <EyeOffIcon className="h-3 w-3" />
            ) : (
              <EyeIcon className="h-3 w-3" />
            )}
          </Button>
        </Tooltip>
      )}
      <Tooltip content={copied ? 'Copiado!' : 'Copiar'}>
        <Button
          size="sm"
          variant="light"
          isIconOnly
          onPress={handleCopy}
          className="min-w-unit-5 h-5 w-5"
        >
          {copied ? (
            <CheckIcon className="h-3 w-3" />
          ) : (
            <CopyIcon className="h-3 w-3" />
          )}
        </Button>
      </Tooltip>
    </div>
  );
}
