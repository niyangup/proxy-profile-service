import type { PublishRequest, PublishStats } from '../../shared/contracts/profile';

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const encoder = new TextEncoder();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStats = (value: unknown): value is PublishStats =>
  isRecord(value) &&
  ['proxies', 'groups', 'rules', 'skippedRules', 'removedInfoNodes'].every(
    (key) => typeof value[key] === 'number' && Number.isInteger(value[key]) && value[key] >= 0,
  );

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const validatePublishRequest = (value: unknown): PublishRequest => {
  if (!isRecord(value)) throw new Error('INVALID_PAYLOAD');
  const { slot, sourceName, sourceFormat, source, surge, quanx, warnings, ignoredSections, stats } =
    value;
  if (
    (slot !== 'primary' && slot !== 'backup') ||
    typeof sourceName !== 'string' ||
    !sourceName.trim() ||
    (sourceFormat !== 'clash' && sourceFormat !== 'surge') ||
    typeof source !== 'string' ||
    typeof surge !== 'string' ||
    typeof quanx !== 'string' ||
    !isStringArray(warnings) ||
    !isStringArray(ignoredSections) ||
    !isStats(stats)
  ) {
    throw new Error('INVALID_PAYLOAD');
  }
  if (stats.proxies === 0 || stats.groups === 0 || stats.rules === 0) {
    throw new Error('INVALID_PAYLOAD');
  }
  if (
    encoder.encode(source).byteLength > MAX_SOURCE_BYTES ||
    encoder.encode(surge).byteLength > MAX_OUTPUT_BYTES ||
    encoder.encode(quanx).byteLength > MAX_OUTPUT_BYTES
  ) {
    throw new Error('PAYLOAD_TOO_LARGE');
  }
  if (!surge.includes('[Proxy]') || !surge.includes('[Proxy Group]') || !surge.includes('[Rule]')) {
    throw new Error('INVALID_SURGE_OUTPUT');
  }
  if (
    !quanx.includes('[server_local]') ||
    !quanx.includes('[policy]') ||
    !quanx.includes('[filter_local]')
  ) {
    throw new Error('INVALID_QUANX_OUTPUT');
  }
  return {
    slot,
    sourceName: sourceName.trim(),
    sourceFormat,
    source,
    surge,
    quanx,
    warnings,
    ignoredSections,
    stats,
  };
};
