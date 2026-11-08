import { cellKey, colorAt } from './pattern';
import type { Pattern } from './pattern';
import { t } from './i18n';

export class Chart {
  private buttons = new Map<string, HTMLButtonElement>();

  constructor(
    private container: HTMLElement,
    private pattern: Pattern,
    private onPaint: (round: number, column: number) => void,
  ) {
    container.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-round]');
      if (!button || button.disabled) return;
      this.focus(button);
      this.onPaint(Number(button.dataset.round), Number(button.dataset.column));
    });
    container.addEventListener('keydown', event => this.navigate(event));
  }

  render(): void {
    this.buttons.clear();
    const { geometry } = this.pattern;
    if (!geometry.rows.length) {
      this.container.textContent = t('No rounds to knit: initial and final stitches are equal.');
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
  }

  private focus(button: HTMLButtonElement): void {
    for (const candidate of this.buttons.values()) {
      if (candidate.tabIndex === 0) candidate.tabIndex = -1;
    }
    button.tabIndex = 0;
    button.focus();
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
    if (target) this.focus(target);
  }
}
