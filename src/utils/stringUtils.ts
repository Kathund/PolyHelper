import type { TemplatePrimitive } from '../types/misc.ts';

export function titleCase(string: string): string {
  if (!string) return '';
  return string
    .toLowerCase()
    .replaceAll('_', ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function titleCaseFromCamel(string: string): string {
  if (!string || typeof string !== 'string') return '';
  const withUnderscores = string.replace(/([a-z])([A-Z])/g, '$1_$2');
  return titleCase(withUnderscores);
}

export function toCamelCase(string: string): string {
  return string
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');
}

export function getTimestamp(time: number = Date.now()): string {
  return new Date(time).toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    timeZoneName: 'short',
    timeZone: 'UTC'
  });
}

export function lowerFirst(string: string): string {
  if (!string) return string;
  return string.charAt(0).toLowerCase() + string.slice(1);
}

export function upperFirst(string: string): string {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let index = 0;

  while (bytes >= 1024 && index < units.length - 1) {
    bytes /= 1024;
    index++;
  }

  return `${bytes.toFixed(2)} ${units[index]}`;
}

export function replaceVariables(template: string, variables: Readonly<Record<string, TemplatePrimitive>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = variables[name];
    return value === null || value === undefined ? match : String(value);
  });
}

export function getReason(reason: string | null | undefined): string {
  return reason ?? 'No reason provided';
}
