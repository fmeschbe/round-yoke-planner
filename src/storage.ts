import type { PlanDocument } from './document';
import { LocalizedError } from './i18n';

export type PlanSummary = Pick<PlanDocument, 'id' | 'name' | 'updatedAt'>;

export class PlanStore {
  private database?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    this.database = new Promise<IDBDatabase>((resolve, reject) => {
      let settled = false;
      const request = indexedDB.open('round-yoke-planner', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('plans', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        if (settled) {
          request.result.close();
          return;
        }
        settled = true;
        request.result.onversionchange = () => {
          request.result.close();
          this.database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        settled = true;
        reject(request.error ?? new LocalizedError('Could not open browser storage.'));
      };
      request.onblocked = () => {
        settled = true;
        reject(new LocalizedError('Browser storage is blocked. Close other planner tabs and try again.'));
      };
    }).catch(error => {
      this.database = undefined;
      throw error;
    });
    return this.database;
  }

  private async request<T>(
    mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('plans', mode);
      let request: IDBRequest<T> | undefined;
      let result: T;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error ?? request?.error ?? new LocalizedError('The storage transaction was aborted.'));
      try {
        request = operation(transaction.objectStore('plans'));
        request.onsuccess = () => { result = request!.result; };
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  }

  async list(): Promise<PlanSummary[]> {
    const documents = await this.request<PlanDocument[]>('readonly', store => store.getAll());
    return documents.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  }

  get(id: string): Promise<PlanDocument | undefined> {
    return this.request('readonly', store => store.get(id));
  }

  async save(document: PlanDocument): Promise<void> {
    await this.request('readwrite', store => store.put(document));
  }

  async delete(id: string): Promise<void> {
    await this.request('readwrite', store => store.delete(id));
  }
}
