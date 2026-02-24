import { normalizeDateOnly, type Activity } from '@/types/activity';

const CLIENT_LABEL_PREFIX = 'client:';
const OBLIGATION_LABEL_PREFIX = 'obligation:';
const START_DATE_LABEL_PREFIX = 'meta:start:';
const END_DATE_LABEL_PREFIX = 'meta:end:';

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function isActivityMetadataLabel(label: string): boolean {
  return (
    label.startsWith(CLIENT_LABEL_PREFIX) ||
    label.startsWith(OBLIGATION_LABEL_PREFIX) ||
    label.startsWith(START_DATE_LABEL_PREFIX) ||
    label.startsWith(END_DATE_LABEL_PREFIX)
  );
}

export type DecodedActivityMetadata = {
  displayLabels: string[];
  linkedClientIds: string[];
  linkedObligationId: string | null;
  startDate: string | null;
  endDate: string | null;
  isObligationLinked: boolean;
};

export function decodeActivityMetadata(
  labels: string[] | null | undefined
): DecodedActivityMetadata {
  const displayLabels: string[] = [];
  const linkedClientIds: string[] = [];

  let linkedObligationId: string | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;

  for (const rawLabel of labels ?? []) {
    const label = rawLabel.trim();
    if (!label) continue;

    if (label.startsWith(CLIENT_LABEL_PREFIX)) {
      const clientId = label.slice(CLIENT_LABEL_PREFIX.length);
      if (isUuidLike(clientId)) {
        linkedClientIds.push(clientId);
      }
      continue;
    }

    if (label.startsWith(OBLIGATION_LABEL_PREFIX)) {
      const obligationId = label.slice(OBLIGATION_LABEL_PREFIX.length);
      if (isUuidLike(obligationId)) {
        linkedObligationId = obligationId;
      }
      continue;
    }

    if (label.startsWith(START_DATE_LABEL_PREFIX)) {
      startDate = normalizeDateOnly(label.slice(START_DATE_LABEL_PREFIX.length));
      continue;
    }

    if (label.startsWith(END_DATE_LABEL_PREFIX)) {
      endDate = normalizeDateOnly(label.slice(END_DATE_LABEL_PREFIX.length));
      continue;
    }

    displayLabels.push(label);
  }

  return {
    displayLabels: unique(displayLabels),
    linkedClientIds: unique(linkedClientIds),
    linkedObligationId,
    startDate,
    endDate,
    isObligationLinked:
      Boolean(linkedObligationId) || (labels ?? []).some((label) => label.trim() === 'obrigacoes'),
  };
}

type ActivityMetadataInput = {
  displayLabels?: string[] | null;
  linkedClientIds?: string[] | null;
  linkedObligationId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export function encodeActivityLabels(metadata: ActivityMetadataInput): string[] {
  const display = (metadata.displayLabels ?? []).filter((label) => {
    const normalized = label.trim();
    return normalized.length > 0 && !isActivityMetadataLabel(normalized);
  });

  const labels: string[] = [...display];

  for (const clientId of metadata.linkedClientIds ?? []) {
    if (isUuidLike(clientId)) {
      labels.push(`${CLIENT_LABEL_PREFIX}${clientId}`);
    }
  }

  if (metadata.linkedObligationId && isUuidLike(metadata.linkedObligationId)) {
    labels.push(`${OBLIGATION_LABEL_PREFIX}${metadata.linkedObligationId}`);
    labels.push('obrigacoes');
  }

  const startDate = normalizeDateOnly(metadata.startDate ?? null);
  if (startDate) {
    labels.push(`${START_DATE_LABEL_PREFIX}${startDate}`);
  }

  const endDate = normalizeDateOnly(metadata.endDate ?? null);
  if (endDate) {
    labels.push(`${END_DATE_LABEL_PREFIX}${endDate}`);
  }

  return unique(labels);
}

export function getActivityVisibleLabels(activity: Pick<Activity, 'labels'>): string[] {
  return decodeActivityMetadata(activity.labels).displayLabels;
}
