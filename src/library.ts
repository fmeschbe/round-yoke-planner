import {
  documentFromPattern, MAX_DOCUMENT_BYTES, parseDocument, patternFromDocument,
  planName, serializeDocument, validateDocument,
} from './document';
import type { PlanDocument } from './document';
import { createPattern } from './pattern';
import type { Pattern } from './pattern';
import { PlanStore } from './storage';
import { calculate, createGeometry } from './yoke';
import { DEFAULT_INPUTS } from './calculator';
import { copyText, errorText, LocalizedError, onLanguageChange, setText, t } from './i18n';
import type { Message, Parameters } from './i18n';
import { printableHTML } from './print';

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export class PlanLibrary {
  private store = new PlanStore();
  private id: string | null = null;
  private createdAt = 0;
  private dirty = false;
  private revision = 0;
  private lastSavedAt = 0;
  private busy = false;
  private named = false;
  private currentName = t('Untitled yoke');
  private naming: 'current' | 'copy' | 'rename' = 'current';
  private renameId = '';
  private returnFocus = element('show-plans');
  private namingFocus = element('plan-status');
  private name = element<HTMLInputElement>('plan-name');
  private saved = element<HTMLSelectElement>('saved-plans');
  private dialog = element<HTMLDialogElement>('plans-dialog');
  private nameDialog = element<HTMLDialogElement>('name-dialog');
  private importDialog = element<HTMLDialogElement>('import-dialog');
  private menu = element('plan-menu');

  constructor(
    private pattern: Pattern,
    private onLoad: () => void,
    private hasDraft: () => boolean,
  ) {
    element('show-plans').addEventListener('click', () => {
      if (this.menu.matches(':popover-open')) this.closeMenu();
      else this.menu.showPopover();
    });
    this.menu.addEventListener('toggle', event => {
      const open = (event as ToggleEvent).newState === 'open';
      element('show-plans').setAttribute('aria-expanded', String(open));
      if (!open) return;
      const rect = element('show-plans').getBoundingClientRect();
      this.menu.style.left = `${Math.max(12, Math.min(rect.right - this.menu.offsetWidth, window.innerWidth - this.menu.offsetWidth - 12))}px`;
      this.menu.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - this.menu.offsetHeight - 12))}px`;
      this.menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    });
    this.menu.addEventListener('keydown', event => this.navigateMenu(event));
    window.addEventListener('resize', () => this.closeMenu());
    element('plan-status').addEventListener('click', () => {
      if (this.busy) return;
      if (!this.named) this.beginNaming('current');
      else void this.action(() => this.save());
    });
    element('close-plans').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => {
      copyText(element('plan-notice'), element('library-error'));
      (this.returnFocus.matches(':disabled') ? element('show-plans') : this.returnFocus).focus();
    });
    this.name.value = this.currentName;
    element('close-name').addEventListener('click', () => this.nameDialog.close());
    this.nameDialog.addEventListener('close', () => {
      this.name.value = this.currentName;
      copyText(element('plan-notice'), element('name-error'));
      (this.namingFocus.matches(':disabled') ? element('show-plans') : this.namingFocus).focus();
    });
    element('name-form').addEventListener('submit', event => {
      event.preventDefault();
      void this.action(() => this.saveName());
    });
    element('save-as').addEventListener('click', () => {
      this.closeMenu();
      this.beginNaming('copy');
    });
    element('load-plan').addEventListener('click', () => this.openLibrary(false));
    element('manage-plans').addEventListener('click', () => this.openLibrary(true));
    element('rename-plan').addEventListener('click', () => {
      this.renameId = this.saved.value;
      this.beginNaming('rename');
    });
    element('open-plan').addEventListener('click', () => void this.action(() => this.open()));
    element('delete-plan').addEventListener('click', () => void this.action(() => this.delete()));
    element('new-plan').addEventListener('click', () => {
      this.closeMenu();
      if (this.busy || !this.confirmDiscard()) return;
      this.id = null;
      this.createdAt = 0;
      this.currentName = t('Untitled yoke');
      this.name.value = this.currentName;
      this.named = false;
      Object.assign(this.pattern, createPattern(createGeometry(calculate(DEFAULT_INPUTS), 1)));
      this.dirty = false;
      this.revision++;
      this.onLoad();
      this.updateStatus();
      this.message('Started a new plan. Save it to keep it in this browser.');
      this.dialog.close();
    });
    element('export-plan').addEventListener('click', () => {
      this.closeMenu();
      void this.action(() => this.export());
    });
    element('export-html').addEventListener('click', () => {
      this.closeMenu();
      void this.action(() => this.printable(false));
    });
    element('print-plan').addEventListener('click', () => void this.action(() => this.printable(true)));
    element('import-plan').addEventListener('click', () => {
      this.closeMenu();
      this.importDialog.showModal();
      setText(element('import-error'), '');
    });
    element('close-import').addEventListener('click', () => this.importDialog.close());
    this.importDialog.addEventListener('close', () => {
      copyText(element('plan-notice'), element('import-error'));
      element('show-plans').focus();
    });
    element('choose-json').addEventListener('click', () => element<HTMLInputElement>('import-file').click());
    element<HTMLInputElement>('import-file').addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (file) void this.action(() => this.import(file));
    });
    const drop = element('drop-zone');
    drop.addEventListener('dragover', event => {
      event.preventDefault();
      drop.classList.add('drag-over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', event => {
      event.preventDefault();
      drop.classList.remove('drag-over');
      const files = event.dataTransfer?.files;
      void this.action(() => {
        if (files?.length !== 1) throw new LocalizedError('Choose one JSON file.');
        return this.import(files[0]);
      });
    });
    this.saved.addEventListener('change', () => this.updateStatus());
    element('persist-storage').addEventListener('click', () => void this.action(async () => {
      if (!navigator.storage?.persist) throw new LocalizedError('This browser does not support persistent-storage requests.');
      const granted = await navigator.storage.persist();
      this.message(granted
        ? 'Persistent storage granted. Clearing browser data can still delete plans; keep JSON backups.'
        : 'Persistent storage was not granted. Keep JSON backups in case browser data is removed.');
    }));
    window.addEventListener('beforeunload', event => {
      if (!this.dirty && !this.hasDraft()) return;
      event.preventDefault();
      event.returnValue = '';
    });
    onLanguageChange(() => this.updateStatus());
    this.updateStatus();
  }

  markDirty(): void {
    this.dirty = true;
    this.revision++;
    this.updateStatus();
  }

  private closeMenu(): void {
    if (this.menu.matches(':popover-open')) this.menu.hidePopover();
  }

  private navigateMenu(event: KeyboardEvent): void {
    const buttons = [...this.menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      this.closeMenu();
      element('show-plans').focus();
    }
  }

  private openLibrary(manage: boolean): void {
    this.closeMenu();
    this.returnFocus = element('show-plans');
    setText(element('library-heading'), manage ? 'Manage plans' : 'Load plan');
    element('open-plan').hidden = manage;
    element('rename-plan').hidden = !manage;
    element('delete-plan').hidden = !manage;
    this.dialog.showModal();
    setText(element('plan-notice'), '');
    void this.action(() => this.refresh().then(() => {}));
  }

  private beginNaming(mode: 'current' | 'copy' | 'rename'): void {
    if (this.busy) return;
    this.naming = mode;
    this.namingFocus = element(mode === 'rename' ? 'rename-plan' : mode === 'current' ? 'plan-status' : 'show-plans');
    this.name.value = mode === 'rename' ? this.saved.selectedOptions[0]?.textContent ?? '' : this.currentName;
    setText(element('name-heading'), mode === 'rename' ? 'Rename plan' : mode === 'copy' ? 'Save as' : 'Save plan');
    setText(element('save-plan'), mode === 'rename' ? 'Rename plan' : 'Save plan');
    element('name-help').hidden = mode !== 'copy';
    setText(element('name-error'), '');
    this.nameDialog.showModal();
    this.name.focus();
    this.name.select();
  }

  async initialize(): Promise<void> {
    const revision = this.revision;
    await this.action(async () => {
      const plans = await this.refresh();
      if (!plans.length || this.dirty || this.revision !== revision) return;
      const document = await this.store.get(plans[0].id);
      if (document && !this.dirty && this.revision === revision) {
        this.load(validateDocument(document));
        this.message('Reopened your most recently saved plan.');
      }
    });
  }

  private updateStatus(): void {
    const status: Message = this.dirty
      ? 'Unsaved changes'
      : this.id ? 'Saved in this browser' : 'Browser only - not saved';
    setText(element('save-status'), status);
    element('plan-status').title = t(status);
    for (const id of ['show-plans', 'save-plan', 'new-plan', 'load-plan', 'save-as', 'manage-plans', 'export-plan', 'export-html', 'print-plan', 'import-plan', 'import-file', 'choose-json']) {
      element<HTMLButtonElement | HTMLInputElement>(id).disabled = this.busy;
    }
    element<HTMLButtonElement>('plan-status').disabled = this.busy || (!!this.id && !this.dirty && !this.hasDraft());
    this.saved.disabled = this.busy || !this.saved.options.length;
    for (const id of ['open-plan', 'rename-plan', 'delete-plan']) {
      element<HTMLButtonElement>(id).disabled = this.busy || !this.saved.value;
    }
    element<HTMLButtonElement>('persist-storage').disabled = this.busy || !navigator.storage?.persist;
  }

  private message(key: Message, parameters: Parameters = {}): void {
    setText(element('library-message'), key, parameters);
    setText(element('library-error'), '');
    setText(element('name-error'), '');
    setText(element('import-error'), '');
    setText(element('plan-notice'), '');
  }

  private async action(operation: () => void | Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    setText(element('library-error'), '');
    setText(element('name-error'), '');
    setText(element('import-error'), '');
    setText(element('plan-notice'), '');
    this.updateStatus();
    try {
      await operation();
    } catch (error) {
      setText(element('library-message'), '');
      setText(element('library-error'), () => errorText(error, 'The operation failed.')
        + (error instanceof DOMException && error.name === 'QuotaExceededError'
          ? '' : t(' Your current plan has not been discarded.')));
      if (this.nameDialog.open) copyText(element('name-error'), element('library-error'));
      else if (this.importDialog.open) copyText(element('import-error'), element('library-error'));
      else if (!this.dialog.open) copyText(element('plan-notice'), element('library-error'));
    } finally {
      this.busy = false;
      this.updateStatus();
    }
  }

  private confirmDiscard(): boolean {
    return (!this.dirty && !this.hasDraft()) || window.confirm(t('Replace the current editor plan and discard its unsaved changes? Saved copies will not be changed.'));
  }

  private snapshot(name = this.currentName): PlanDocument {
    if (this.hasDraft()) throw new LocalizedError('Select Calculate / Apply before saving or exporting changed inputs.');
    const now = Date.now();
    return documentFromPattern(this.pattern, {
      id: this.id ?? crypto.randomUUID(), name: planName(name),
      createdAt: this.createdAt || now, updatedAt: Math.max(now, this.createdAt, this.lastSavedAt + 1),
    });
  }

  private async refresh() {
    const plans = await this.store.list();
    this.lastSavedAt = plans[0]?.updatedAt ?? 0;
    const selected = this.saved.value;
    this.saved.replaceChildren(...plans.map(plan => {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.name;
      return option;
    }));
    if (plans.some(plan => plan.id === this.id)) this.saved.value = this.id!;
    else if (plans.some(plan => plan.id === selected)) this.saved.value = selected;
    return plans;
  }

  private async save(name = this.currentName, copy = false): Promise<void> {
    const document = this.snapshot(name);
    if (copy) {
      document.id = crypto.randomUUID();
      document.createdAt = Date.now();
      document.updatedAt = Math.max(document.createdAt, document.updatedAt);
    }
    serializeDocument(document);
    const revision = this.revision;
    setText(element('library-message'), 'Saving...');
    await this.store.save(document);
    this.id = document.id;
    this.createdAt = document.createdAt;
    this.dirty = this.revision !== revision;
    this.currentName = document.name;
    this.name.value = this.currentName;
    this.named = true;
    this.message(this.dirty ? 'Saved the snapshot. New changes remain unsaved.' : 'Saved in this browser.');
    await this.refresh();
  }

  private async saveName(): Promise<void> {
    const name = planName(this.name.value);
    if (this.naming === 'rename') {
      const stored = await this.store.get(this.renameId);
      if (!stored) throw new LocalizedError('That saved plan no longer exists. Reload the library and try again.');
      const document = validateDocument(stored);
      document.name = name;
      document.updatedAt = Math.max(Date.now(), document.updatedAt + 1, this.lastSavedAt + 1);
      serializeDocument(document);
      await this.store.save(document);
      if (this.id === document.id) {
        this.currentName = name;
        this.named = true;
      }
      this.message('Renamed the saved plan.');
      await this.refresh();
      this.saved.value = document.id;
    } else await this.save(name, this.naming === 'copy');
    this.nameDialog.close();
  }

  private load(document: PlanDocument): void {
    const restored = patternFromDocument(document);
    Object.assign(this.pattern, restored);
    this.id = document.id;
    this.createdAt = document.createdAt;
    this.name.value = document.name;
    this.currentName = document.name;
    this.named = true;
    if ([...this.saved.options].some(option => option.value === document.id)) this.saved.value = document.id;
    this.dirty = false;
    this.revision++;
    this.onLoad();
  }

  private async open(): Promise<void> {
    const document = await this.store.get(this.saved.value);
    if (!document) throw new LocalizedError('That saved plan no longer exists. Reload the library and try again.');
    const validated = validateDocument(document);
    if (!this.confirmDiscard()) return;
    this.load(validated);
    this.message('Opened the saved plan.');
    this.dialog.close();
  }

  private async delete(): Promise<void> {
    const id = this.saved.value;
    const name = this.saved.selectedOptions[0]?.textContent ?? t('this plan');
    if (!window.confirm(t('Delete the saved copy of "{name}"? This cannot be undone.', { name }))) return;
    await this.store.delete(id);
    if (id === this.id) {
      this.id = null;
      this.createdAt = 0;
      this.markDirty();
      this.message('Deleted the saved copy. The current plan is still in this tab, unsaved.');
    } else this.message('Deleted the saved plan.');
    await this.refresh();
  }

  private export(): void {
    const plan = this.snapshot();
    const text = serializeDocument(plan);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${plan.name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'yoke-plan'}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.message('Exported the current applied plan as JSON. Exporting does not save it in this browser.');
  }

  private printable(open: boolean): void {
    const plan = this.snapshot();
    const html = printableHTML(plan);
    if (open) {
      const view = window.open('about:blank', '_blank');
      if (!view) throw new LocalizedError('Allow pop-ups to open the print view, or download printable HTML instead.');
      view.opener = null;
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      view.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      this.message('Opened the print view. Use Print / Save as PDF in the new tab.');
    } else {
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${plan.name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'yoke-plan'}.html`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.message('Downloaded printable HTML for the current plan.');
    }
  }

  private async import(file: File): Promise<void> {
    if (file.size > MAX_DOCUMENT_BYTES) throw new LocalizedError('Plan files must be no larger than 1 MiB.');
    const document = parseDocument(await file.text());
    if (!this.confirmDiscard()) return;
    const now = Date.now();
    document.id = crypto.randomUUID();
    document.createdAt = now;
    document.updatedAt = now;
    this.load(document);
    this.id = null;
    this.createdAt = 0;
    this.markDirty();
    this.message('The current editor plan was replaced with a new, unsaved JSON plan. Select Save to add it to this browser.');
    this.dialog.close();
    this.importDialog.close();
  }
}
