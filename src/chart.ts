import { cellKey, colorAt } from './pattern';
import type { Pattern } from './pattern';
import { setText, t } from './i18n';
import { applyPaste, clearRectangle, copyRectangle, preparePaste } from './clipboard';
import type { Rectangle, StitchClipboard } from './clipboard';
import type { Geometry } from './yoke';

interface Point { round: number; column: number }

export class Chart {
  private buttons = new Map<string, HTMLButtonElement>();
  private geometry?: Geometry;
  private selection: Rectangle | null = null;
  private clipboard?: StitchClipboard;
  private selecting = false;
  private pasting = false;
  private anchor?: Point;
  private keyboardAnchor?: Point;
  private pointer?: { id: number; hadAnchor: boolean; moved: boolean };
  private panel = document.getElementById('chart-editor')!;
  private dialog = document.getElementById('chart-fullscreen') as HTMLDialogElement;
  private placeholder?: Comment;

  constructor(
    private container: HTMLElement,
    private pattern: Pattern,
    private onPaint: (round: number, column: number) => void,
    private onEdit: () => void,
  ) {
    container.addEventListener('click', event => {
      const point = this.point(event.target);
      if (this.pasting && point) {
        this.paste(point);
        return;
      }
      if (this.selecting) return;
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-round]');
      if (!button || button.disabled) return;
      this.cancelSelection();
      this.focus(button);
      this.onPaint(Number(button.dataset.round), Number(button.dataset.column));
    });
    this.panel.addEventListener('keydown', event => this.keydown(event));
    container.addEventListener('pointerdown', event => {
      if (!this.selecting || event.button !== 0) return;
      const point = this.point(event.target);
      if (!point) return;
      event.preventDefault();
      this.pointer = { id: event.pointerId, hadAnchor: !!this.anchor, moved: false };
      this.anchor ??= point;
      this.select(this.anchor, point);
      this.focusPoint(point);
      container.setPointerCapture(event.pointerId);
    });
    container.addEventListener('pointermove', event => {
      if (this.pointer?.id !== event.pointerId || !this.anchor) return;
      const point = this.point(document.elementFromPoint(event.clientX, event.clientY));
      if (!point) return;
      if (point.round !== this.anchor.round || point.column !== this.anchor.column) this.pointer.moved = true;
      this.select(this.anchor, point);
    });
    container.addEventListener('pointerup', event => {
      if (this.pointer?.id !== event.pointerId) return;
      if (this.pointer.hadAnchor || this.pointer.moved) this.anchor = undefined;
      this.pointer = undefined;
      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    });
    container.addEventListener('pointercancel', () => { this.pointer = undefined; });
    this.control('expand-chart').addEventListener('click', () => this.expand());
    this.dialog.addEventListener('close', () => {
      this.placeholder?.replaceWith(this.panel);
      this.placeholder = undefined;
      this.updateTools();
      this.control('expand-chart').focus();
    });
    this.control('clear-chart').addEventListener('click', () => {
      const count = this.pattern.cells.size;
      if (!count || !window.confirm(t(count === 1
        ? 'Clear the colored stitch? The palette and chart size will remain unchanged.'
        : 'Clear all {count} colored stitches? The palette and chart size will remain unchanged.', { count }))) return;
      this.pattern.cells.clear();
      this.cancelSelection();
      this.onEdit();
      setText(document.getElementById('chart-edit-status')!, 'Chart cleared.');
    });
    this.control('select-chart').addEventListener('click', () => {
      const selecting = !this.selecting;
      this.cancelSelection();
      this.selecting = selecting;
      this.updateTools();
    });
    this.control('copy-chart').addEventListener('click', () => this.copy(false));
    this.control('cut-chart').addEventListener('click', () => this.copy(true));
    this.control('paste-chart').addEventListener('click', () => {
      this.pasting = !this.pasting;
      this.selecting = false;
      this.anchor = undefined;
      this.keyboardAnchor = undefined;
      setText(document.getElementById('chart-edit-status')!, this.pasting ? 'Choose the top-left paste destination.' : '');
      this.updateTools();
    });
  }

  render(): void {
    const focused = document.activeElement as HTMLButtonElement | null;
    const focusedKey = focused && this.container.contains(focused)
      ? cellKey(Number(focused.dataset.round), Number(focused.dataset.column)) : undefined;
    if (this.geometry !== this.pattern.geometry) {
      this.geometry = this.pattern.geometry;
      this.cancelSelection();
    }
    this.buttons.clear();
    const { geometry } = this.pattern;
    if (!geometry.rows.length) {
      this.container.textContent = t('No rounds to knit: initial and final stitches are equal.');
      this.updateTools();
      return;
    }
    const table = document.createElement('table');
    const caption = table.createCaption();
    caption.textContent = t('One repeating segment: {columns} columns, {rounds} rounds. Row 1 is at the top.', { columns: geometry.width, rounds: geometry.rows.length });
    caption.className = 'sr-only';
    const head = table.createTHead().insertRow();
    const corner = document.createElement('th');
    corner.textContent = t('Round');
    corner.scope = 'col';
    head.append(corner);
    for (let column = 0; column < geometry.width; column++) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = String(column + 1);
      head.append(th);
    }
    const body = table.createTBody();
    for (const row of geometry.rows) {
      const tr = body.insertRow();
      tr.dataset.round = String(row.round);
      tr.classList.toggle('increase-row', row.increase);
      const label = document.createElement('th');
      label.scope = 'row';
      label.textContent = String(row.round);
      label.title = t(row.increase
        ? '{stitches} stitches around the yoke; increase round'
        : '{stitches} stitches around the yoke; plain round', { stitches: row.stitches });
      if (row.increase) {
        const badge = document.createElement('span');
        badge.textContent = '+';
        badge.className = 'increase-badge';
        badge.setAttribute('aria-label', t('Increase round'));
        label.append(badge);
      }
      if (geometry.calculation.initialRounds || geometry.calculation.finalRounds) {
        const section = document.createElement('small');
        section.className = 'section-round';
        section.textContent = t(row.section === 'initial' ? 'I{round}' : row.section === 'yoke' ? 'Y{round}' : 'F{round}', { round: row.sectionRound });
        label.append(section);
      }
      tr.append(label);
      const active = new Set(row.columns);
      const added = new Set(row.addedColumns);
      const markers = new Set<number>();
      if (row.increase) {
        const count = Math.ceil(geometry.calculation.ip / geometry.segments);
        if (count > geometry.width) {
          for (let column = 0; column < geometry.width; column++) markers.add(column);
        } else {
          for (let k = 0; k < count; k++) {
            markers.add(Math.floor(k * geometry.segments / geometry.calculation.ip * geometry.width));
          }
        }
      }
      for (let column = 0; column < geometry.width; column++) {
        const td = tr.insertCell();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'stitch';
        button.classList.toggle('added-stitch', added.has(column));
        button.dataset.round = String(row.round);
        button.dataset.column = String(column);
        button.disabled = !active.has(column);
        button.tabIndex = -1;
        td.classList.toggle('no-stitch', button.disabled);
        if (markers.has(column)) {
          td.classList.add('increase-point');
          td.title = t('Evenly spaced increase point (schematic)');
        }
        if (button.disabled) {
          button.setAttribute('aria-label', t('Round {round}, column {column}: no stitch', { round: row.round, column: column + 1 }));
        } else {
          this.buttons.set(cellKey(row.round, column), button);
        }
        td.append(button);
      }
    }
    this.container.replaceChildren(table);
    const firstRow = geometry.rows[0];
    const first = this.buttons.get(cellKey(firstRow.round, firstRow.columns[0]));
    if (first) first.tabIndex = 0;
    this.updateColors();
    this.updateSelection();
    if (focusedKey && this.buttons.has(focusedKey)) this.focus(this.buttons.get(focusedKey)!);
  }

  updateColors(): void {
    for (const [key, button] of this.buttons) {
      const round = Number(button.dataset.round);
      const column = Number(button.dataset.column);
      const id = this.pattern.cells.get(key);
      const color = colorAt(this.pattern, round, column);
      const addition = button.classList.contains('added-stitch') ? t('; schematic added stitch') : '';
      button.style.backgroundColor = color;
      button.classList.toggle('colored', id !== undefined);
      button.setAttribute('aria-label', t('Round {round}, column {column}: {color}{addition}', {
        round, column: column + 1, color: id ? t('color {color}', { color }) : t('uncolored stitch'), addition,
      }));
      button.setAttribute('aria-pressed', String(id !== undefined));
      button.title = t('Round {round}, column {column}: {color}{addition}', {
        round, column: column + 1, color: id ? color : t('uncolored'), addition,
      });
    }
    this.updateTools();
  }

  private control(id: string): HTMLButtonElement {
    return document.getElementById(id) as HTMLButtonElement;
  }

  private point(target: EventTarget | null): Point | undefined {
    if (!(target instanceof Element)) return;
    const cell = target.closest('td');
    if (!cell || !this.container.contains(cell)) return;
    const button = cell.querySelector<HTMLButtonElement>('button[data-round]');
    if (button) return { round: Number(button.dataset.round), column: Number(button.dataset.column) };
  }

  private focusPoint(point: Point): void {
    const row = this.pattern.geometry.rows[point.round - 1];
    const column = row.columns.find(column => column >= point.column) ?? row.columns.at(-1)!;
    const button = this.buttons.get(cellKey(point.round, column));
    if (button) this.focus(button, true);
  }

  private select(first: Point, last: Point): void {
    this.selection = {
      firstRound: Math.min(first.round, last.round), lastRound: Math.max(first.round, last.round),
      firstColumn: Math.min(first.column, last.column), lastColumn: Math.max(first.column, last.column),
    };
    this.updateSelection();
  }

  private updateSelection(): void {
    const rectangle = this.selection;
    for (const cell of this.container.querySelectorAll<HTMLTableCellElement>('tbody td')) {
      const point = this.point(cell)!;
      cell.classList.toggle('selected', !!rectangle
        && point.round >= rectangle.firstRound && point.round <= rectangle.lastRound
        && point.column >= rectangle.firstColumn && point.column <= rectangle.lastColumn);
    }
    setText(document.getElementById('chart-selection')!, rectangle
      ? () => t('Selection: rounds {firstRound}–{lastRound}, columns {firstColumn}–{lastColumn}.', {
        ...rectangle, firstColumn: rectangle.firstColumn + 1, lastColumn: rectangle.lastColumn + 1,
      }) : '');
    this.updateTools();
  }

  private cancelSelection(): void {
    this.selection = null;
    this.selecting = false;
    this.pasting = false;
    this.anchor = undefined;
    this.keyboardAnchor = undefined;
    this.pointer = undefined;
    setText(document.getElementById('chart-edit-status')!, '');
    setText(document.getElementById('chart-edit-error')!, '');
    this.updateSelection();
  }

  private updateTools(): void {
    const expanded = this.dialog.open;
    const expand = this.control('expand-chart');
    const name = t(expanded ? 'Exit full-screen chart' : 'Expand stitch chart');
    expand.setAttribute('aria-label', name);
    expand.title = name;
    expand.setAttribute('aria-pressed', String(expanded));
    expand.querySelector('span')!.textContent = expanded ? '↩️' : '🖥️';
    this.control('clear-chart').disabled = !this.pattern.cells.size;
    this.control('select-chart').disabled = !this.pattern.geometry.rows.length;
    this.control('select-chart').setAttribute('aria-pressed', String(this.selecting));
    this.control('copy-chart').disabled = !this.selection;
    this.control('cut-chart').disabled = !this.selection;
    this.control('paste-chart').disabled = !this.clipboard?.rows.length || !this.pattern.geometry.rows.length;
    this.control('paste-chart').setAttribute('aria-pressed', String(this.pasting));
    this.container.classList.toggle('selecting', this.selecting);
    this.container.classList.toggle('pasting', this.pasting);
  }

  private expand(): void {
    if (this.dialog.open) {
      this.dialog.close();
      return;
    }
    this.placeholder = document.createComment('chart position');
    this.panel.before(this.placeholder);
    this.dialog.append(this.panel);
    this.dialog.showModal();
    this.updateTools();
  }

  private copy(cut: boolean): void {
    if (!this.selection) return;
    this.clipboard = copyRectangle(this.pattern, this.selection);
    if (cut && clearRectangle(this.pattern, this.selection)) this.onEdit();
    setText(document.getElementById('chart-edit-status')!, cut
      ? 'Selection cut. Choose Paste, then click its top-left destination.'
      : 'Selection copied. Choose Paste, then click its top-left destination.');
    this.updateTools();
  }

  private paste(point: Point): void {
    if (!this.clipboard) return;
    const paste = preparePaste(this.pattern, this.clipboard, point.round, point.column);
    if (paste.paletteOverflow) {
      setText(document.getElementById('chart-edit-error')!, 'Pasting would exceed 5,000 palette colors. Remove unused colors first.');
      return;
    }
    if (paste.omittedColors && !window.confirm(t(paste.omittedColors === 1
      ? 'Pasting here omits one colored stitch. Paste what fits?'
      : 'Pasting here omits {count} colored stitches. Paste what fits?', { count: paste.omittedColors }))) return;
    if (applyPaste(this.pattern, paste)) this.onEdit();
    this.cancelSelection();
    if (paste.assignments.length) {
      this.selection = {
        firstRound: point.round, lastRound: Math.max(...paste.assignments.map(cell => cell.round)),
        firstColumn: point.column, lastColumn: Math.max(...paste.assignments.map(cell => cell.column)),
      };
      this.updateSelection();
    }
    this.focusPoint(point);
    setText(document.getElementById('chart-edit-status')!, 'Selection pasted.');
  }

  private keydown(event: KeyboardEvent): void {
    if ((event.target as Element).closest('input, select, textarea, [contenteditable="true"]')) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'c' || key === 'x') {
        if (!this.selection) {
          const point = this.point(event.target);
          if (point) this.select(point, point);
        }
        if (this.selection) {
          event.preventDefault();
          this.copy(key === 'x');
        }
        return;
      }
      if (key === 'v' && this.clipboard) {
        const point = this.selection
          ? { round: this.selection.firstRound, column: this.selection.firstColumn } : this.point(event.target);
        if (point) {
          event.preventDefault();
          this.paste(point);
        }
        return;
      }
    }
    if (event.key === 'Escape' && (this.selection || this.selecting || this.pasting)) {
      event.preventDefault();
      this.cancelSelection();
      return;
    }
    if (this.selecting && (event.key === 'Enter' || event.key === ' ')) {
      const point = this.point(event.target);
      if (point) {
        event.preventDefault();
        this.select(this.anchor ?? point, point);
        this.anchor = this.anchor ? undefined : point;
      }
      return;
    }
    this.navigate(event);
  }

  private focus(button: HTMLButtonElement, preventScroll = false): void {
    for (const candidate of this.buttons.values()) {
      if (candidate.tabIndex === 0) candidate.tabIndex = -1;
    }
    button.tabIndex = 0;
    button.focus({ preventScroll });
  }

  private navigate(event: KeyboardEvent): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-round]');
    if (!button || button.disabled) return;
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const { rows } = this.pattern.geometry;
    let round = Number(button.dataset.round);
    let column = Number(button.dataset.column);
    const origin = { round, column };
    if (event.key === 'ArrowUp') round = Math.max(1, round - 1);
    if (event.key === 'ArrowDown') round = Math.min(rows.length, round + 1);
    const columns = rows[round - 1].columns;
    if (event.key === 'Home') column = columns[0];
    else if (event.key === 'End') column = columns.at(-1)!;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const index = columns.indexOf(column);
      column = columns[Math.max(0, Math.min(columns.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))];
    } else {
      column = columns.reduce((best, candidate) =>
        Math.abs(candidate - column) < Math.abs(best - column) ? candidate : best);
    }
    const target = this.buttons.get(cellKey(round, column));
    if (target) {
      this.focus(target);
      if (event.shiftKey) {
        this.keyboardAnchor ??= origin;
        this.selecting = true;
        this.pasting = false;
        this.select(this.keyboardAnchor, { round, column });
      } else {
        const selecting = this.selecting;
        this.cancelSelection();
        this.selecting = selecting;
        this.updateTools();
      }
    }
  }
}
