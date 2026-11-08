import { german } from './locales/de';
import { norwegian } from './locales/nb';

export type Language = 'en' | 'de' | 'nb';
export type Message = keyof typeof german;
export type Parameters = Record<string, string | number>;
export const catalogs: Record<Language, Record<Message, string>> = {
  en: Object.fromEntries(Object.keys(german).map(key => [key, key])) as Record<Message, string>,
  de: german,
  nb: norwegian,
};
const PREFERENCE_KEY = 'round-yoke-planner-language';
let language: Language = 'en';
const bindings = new Map<HTMLElement, () => string>();
const listeners = new Set<() => void>();
let staticText: { node: Text; source: string; key: Message }[] = [];
let staticAttributes: { element: Element; attribute: string; key: Message }[] = [];

export function getLanguage(): Language {
  return language;
}

export function preferredLanguage(saved: string | null, browser: string): Language {
  if (saved && Object.hasOwn(catalogs, saved)) return saved as Language;
  if (/^(?:nb|no)(?:-|$)/i.test(browser)) return 'nb';
  return /^de(?:-|$)/i.test(browser) ? 'de' : 'en';
}

export function t(key: Message, parameters: Parameters = {}, locale: Language = language): string {
  return catalogs[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => String(parameters[name] ?? `{${name}}`));
}

export function setText(element: HTMLElement, key: Message | '' | (() => string), parameters: Parameters = {}): void {
  const render = typeof key === 'function' ? key : () => key ? t(key, parameters) : '';
  bindings.set(element, render);
  element.textContent = render();
}

export function copyText(target: HTMLElement, source: HTMLElement): void {
  setText(target, bindings.get(source) ?? (() => source.textContent ?? ''));
}

export class LocalizedError extends Error {
  constructor(public key: Message, public parameters: Parameters = {}) {
    super(t(key, parameters));
  }
}

export function errorText(error: unknown, fallback: Message): string {
  if (error instanceof LocalizedError) return t(error.key, error.parameters);
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') return t('Browser storage is full. Your current plan is still available; export JSON as a backup.');
    if (error.name === 'SecurityError') return t('Browser storage is unavailable.');
    if (error.name === 'AbortError') return t('The storage transaction was aborted.');
  }
  return t(fallback);
}

export function onLanguageChange(listener: () => void): void {
  listeners.add(listener);
}

export function setLanguage(value: Language, remember = true): void {
  language = value;
  if (remember) {
    try { localStorage.setItem(PREFERENCE_KEY, value); } catch { /* Language switching also works without storage. */ }
  }
  document.documentElement.lang = value;
  const select = document.getElementById('language') as HTMLSelectElement | null;
  if (select) select.value = value;
  for (const { node, source, key } of staticText) {
    node.textContent = `${source.match(/^\s*/)?.[0] ?? ''}${t(key)}${source.match(/\s*$/)?.[0] ?? ''}`;
  }
  for (const { element, attribute, key } of staticAttributes) element.setAttribute(attribute, t(key));
  for (const [element, render] of bindings) {
    if (element.isConnected) element.textContent = render();
    else bindings.delete(element);
  }
  for (const listener of listeners) listener();
}

export function initializeLocalization(): void {
  staticText = [];
  staticAttributes = [];
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest('script, style')) continue;
    const source = node.textContent ?? '';
    const key = source.trim().replace(/\s+/g, ' ');
    if (Object.hasOwn(catalogs.en, key)) staticText.push({ node, source, key: key as Message });
  }
  for (const element of document.querySelectorAll('[aria-label], [title]')) {
    for (const attribute of ['aria-label', 'title']) {
      const key = element.getAttribute(attribute);
      if (key && Object.hasOwn(catalogs.en, key)) staticAttributes.push({ element, attribute, key: key as Message });
    }
  }
  let saved: string | null = null;
  try { saved = localStorage.getItem(PREFERENCE_KEY); } catch { /* Browser language remains available. */ }
  setLanguage(preferredLanguage(saved, navigator.language), false);
  document.getElementById('language')!.addEventListener('change', event => {
    setLanguage((event.target as HTMLSelectElement).value as Language);
  });
}
