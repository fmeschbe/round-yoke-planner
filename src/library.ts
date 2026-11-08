import {
  documentFromPattern, MAX_DOCUMENT_BYTES, parseDocument, patternFromDocument,
  planName, serializeDocument, validateDocument,
} from './document';
import type { PlanDocument } from './document';
import { createPattern } from './pattern';
import type { Pattern } from './pattern';
import { PlanStore } from './storage';
import { calculate, createGeometry } from './yoke';
import { copyText, errorText, LocalizedError, onLanguageChange, setText, t } from './i18n';
import type { Message, Parameters } from './i18n';

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
  private name = element<HTMLInputElement>('plan-name');
  private saved = element<HTMLSelectElement>('saved-plans');
  private dialog = element<HTMLDialogElement>('plans-dialog');

  constructor(
    private pattern: Pattern,
    private onLoad: () => void,
    private hasDraft: () => boolean,
  ) {
    element('show-plans').addEventListener('click', () => {
      this.dialog.showModal();
      setText(element('plan-notice'), '');
    });
    element('close-plans').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => {
      copyText(element('plan-notice'), element('library-error'));
      element('show-plans').focus();
    });
    this.name.value = t('Untitled yoke');
    this.name.addEventListener('input', () => this.markDirty());
    element('save-plan').addEventListener('click', () => void this.action(() => this.save()));
    element('open-plan').addEventListener('click', () => void this.action(() => this.open()));
    element('delete-plan').addEventListener('click', () => void this.action(() => this.delete()));
    element('new-plan').addEventListener('click', () => {
      if (this.busy || !this.confirmDiscard()) return;
      this.id = null;
      this.createdAt = 0;
      this.name.value = t('Untitled yoke');
      Object.assign(this.pattern, createPattern(createGeometry(calculate({ si: 64, ip: 8, sf: 160 }), 1)));
      this.dirty = false;
      this.revision++;
      this.onLoad();
      this.updateStatus();
      this.message('Started a new plan. Save it to keep it in this browser.');
      this.dialog.close();
    });
    element('export-plan').addEventListener('click', () => void this.action(() => this.export()));
    element('import-plan').addEventListener('click', () => element<HTMLInputElement>('import-file').click());
    element<HTMLInputElement>('import-file').addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (file) void this.action(() => this.import(file));
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
    setText(element('plan-status'), this.dirty
      ? 'Unsaved changes'
      : this.id ? 'Saved in this browser' : 'Browser only - not saved');
    for (const id of ['save-plan', 'new-plan', 'export-plan', 'import-plan', 'import-file']) {
      element<HTMLButtonElement | HTMLInputElement>(id).disabled = this.busy;
    }
    this.saved.disabled = this.busy || !this.saved.options.length;
    for (const id of ['open-plan', 'delete-plan']) {
      element<HTMLButtonElement>(id).disabled = this.busy || !this.saved.value;
    }
    element<HTMLButtonElement>('persist-storage').disabled = this.busy || !navigator.storage?.persist;
  }

  private message(key: Message, parameters: Parameters = {}): void {
    setText(element('library-message'), key, parameters);
    setText(element('library-error'), '');
    setText(element('plan-notice'), '');
  }

  private async action(operation: () => void | Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    setText(element('library-error'), '');
    setText(element('plan-notice'), '');
    this.updateStatus();
    try {
      await operation();
    } catch (error) {
      setText(element('library-message'), '');
      setText(element('library-error'), () => errorText(error, 'The operation failed.')
        + (error instanceof DOMException && error.name === 'QuotaExceededError'
          ? '' : t(' Your current plan has not been discarded.')));
      if (!this.dialog.open) copyText(element('plan-notice'), element('library-error'));
    } finally {
      this.busy = false;
      this.updateStatus();
    }
  }

  private confirmDiscard(): boolean {
    return (!this.dirty && !this.hasDraft()) || window.confirm(t('Replace the current editor plan and discard its unsaved changes? Saved copies will not be changed.'));
  }

  private snapshot(): PlanDocument {
    if (this.hasDraft()) throw new LocalizedError('Select Calculate / Apply before saving or exporting changed inputs.');
    const now = Date.now();
    return documentFromPattern(this.pattern, {
      id: this.id ?? crypto.randomUUID(), name: planName(this.name.value),
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

  private async save(): Promise<void> {
    const document = this.snapshot();
    serializeDocument(document);
    const revision = this.revision;
    setText(element('library-message'), 'Saving...');
    await this.store.save(document);
    this.id = document.id;
    this.createdAt = document.createdAt;
    this.dirty = this.revision !== revision;
    if (!this.dirty) this.name.value = document.name;
    this.message(this.dirty ? 'Saved the snapshot. New changes remain unsaved.' : 'Saved in this browser.');
    await this.refresh();
  }

  private load(document: PlanDocument): void {
    const restored = patternFromDocument(document);
    Object.assign(this.pattern, restored);
    this.id = document.id;
    this.createdAt = document.createdAt;
    this.name.value = document.name;
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
    this.dialog.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.message('Exported the current applied plan as JSON. Exporting does not save it in this browser.');
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
  }
}
