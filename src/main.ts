import './styles.css';
import { Chart } from './chart';
import { PlanLibrary } from './library';
import { Preview } from './preview';
import { calculate, createGeometry, PlanError, sameGeometry } from './yoke';
import type { InputField } from './yoke';
import { addColor, applyGeometry, changeColor, createPattern, paint, removeColor } from './pattern';

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const form = element<HTMLFormElement>('calculator');
const segments = element<HTMLSelectElement>('segments');
const visible = element<HTMLInputElement>('visible-segments');
const pattern = createPattern(createGeometry(calculate({ si: 64, ip: 8, sf: 160 }), 1));
const preview = new Preview(element('preview'), element('preview-description'), element('preview-mode'), pattern);
const chart = new Chart(element('chart'), pattern, (round, column) => {
  if (!paint(pattern, round, column)) return;
  library.markDirty();
  updateColors();
  element('status').textContent = `Updated round ${round}, column ${column + 1}.`;
});
const library = new PlanLibrary(pattern, () => {
  const calculation = pattern.geometry.calculation;
  for (const field of ['si', 'ip', 'sf'] as const) element<HTMLInputElement>(field).value = String(calculation[field]);
  element<HTMLInputElement>('background').value = pattern.background;
  clearErrors();
  renderConfiguration();
  renderPalette();
}, () => (['si', 'ip', 'sf'] as const).some(field =>
  Number(element<HTMLInputElement>(field).value) !== pattern.geometry.calculation[field]));

function updateColors(): void {
  chart.updateColors();
  preview.updateColors();
}

function renderConfiguration(): void {
  const { geometry } = pattern;
  const { calculation } = geometry;
  const results = element('results');
  results.replaceChildren();
  const total = document.createElement('div');
  total.className = 'round-total';
  const number = document.createElement('strong');
  number.textContent = String(calculation.rounds);
  const unit = document.createElement('span');
  unit.textContent = 'rounds to knit';
  total.append(number, unit);
  const detail = document.createElement('p');
  detail.className = 'result-detail';
  detail.textContent = `${calculation.si} to ${calculation.sf} stitches. ${calculation.increases} increase rounds, every ${calculation.interval} round${calculation.interval === 1 ? '' : 's'}.`;
  const rowCounts = document.createElement('p');
  rowCounts.className = 'hint';
  const countGroups: string[] = [];
  for (const row of geometry.rows) {
    const previous = geometry.rows[row.round - 2];
    if (!previous || previous.stitches !== row.stitches) {
      countGroups.push(`R${row.round}: ${row.stitches}`);
    }
  }
  rowCounts.textContent = countGroups.length <= 16
    ? `Stitches per round (until the next change): ${countGroups.join(' / ') || 'no rounds'}.`
    : 'Hover a chart row number for its full-round stitch count.';
  results.append(total, detail, rowCounts);
  segments.replaceChildren(...calculation.segmentOptions.map(({ count, feasible }) => {
    const option = document.createElement('option');
    option.value = String(count);
    option.textContent = `${count} segment${count === 1 ? '' : 's'}${feasible ? '' : ' - exceeds 5,000 slots'}`;
    option.disabled = !feasible;
    return option;
  }));
  segments.value = String(geometry.segments);
  visible.max = String(geometry.segments);
  visible.value = String(pattern.visibleSegments);
  visible.disabled = calculation.rounds === 0;
  element<HTMLButtonElement>('full-circle').disabled = calculation.rounds === 0;
  element('visible-error').textContent = '';
  element('segment-description').textContent = `Edit one of ${geometry.segments} repeated segments. Segment counts must divide every round.`;
  element('chart-size').textContent = `${geometry.width} columns x ${calculation.rounds} rounds`;
  chart.render();
  preview.render();
}

function renderPalette(): void {
  const container = element('palette-colors');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'swatch clear-swatch';
  clear.textContent = 'Clear';
  clear.setAttribute('aria-label', 'Select clear');
  clear.setAttribute('aria-pressed', String(pattern.selected === null));
  clear.addEventListener('click', () => {
    if (pattern.selected !== null) library.markDirty();
    pattern.selected = null;
    updateSelection();
  });
  container.replaceChildren(clear);
  pattern.colors.forEach((color, index) => {
    const row = document.createElement('div');
    row.className = 'palette-row';
    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'swatch';
    select.dataset.colorId = color.id;
    select.style.backgroundColor = color.value;
    select.setAttribute('aria-label', `Select color ${index + 1}`);
    select.setAttribute('aria-pressed', String(pattern.selected === color.id));
    const mark = document.createElement('span');
    mark.className = 'swatch-number';
    mark.textContent = String(index + 1);
    select.append(mark);
    select.addEventListener('click', () => {
      if (pattern.selected !== color.id) library.markDirty();
      pattern.selected = color.id;
      updateSelection();
    });
    const edit = document.createElement('input');
    edit.type = 'color';
    edit.value = color.value;
    edit.setAttribute('aria-label', `Edit color ${index + 1}`);
    edit.addEventListener('input', () => {
      if (color.value !== edit.value) library.markDirty();
      changeColor(pattern, color.id, edit.value);
      select.style.backgroundColor = edit.value;
      updateColors();
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-color';
    remove.setAttribute('aria-label', `Remove color ${index + 1}`);
    remove.title = `Remove color ${index + 1}`;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7');
    icon.append(path);
    remove.append(icon);
    remove.addEventListener('click', () => {
      removeColor(pattern, color.id);
      library.markDirty();
      renderPalette();
      updateColors();
      element<HTMLButtonElement>('add-color').focus();
      element('status').textContent = 'Color removed. Its stitches are now clear.';
    });
    row.append(select, edit, remove);
    container.append(row);
  });
}

function updateSelection(): void {
  for (const button of element('palette-colors').querySelectorAll<HTMLButtonElement>('.swatch')) {
    button.setAttribute('aria-pressed', String((button.dataset.colorId ?? null) === pattern.selected));
  }
}

function clearErrors(): void {
  element('calculation-error').textContent = '';
  for (const field of ['si', 'ip', 'sf']) {
    element(`${field}-error`).textContent = '';
    element(field).removeAttribute('aria-invalid');
  }
}

function confirmGeometry(geometry: typeof pattern.geometry): boolean {
  if (sameGeometry(pattern.geometry, geometry)) return true;
  if (pattern.cells.size && !window.confirm('Changing the yoke or repeating segments will clear your pattern. Keep the palette and continue?')) {
    return false;
  }
  applyGeometry(pattern, geometry);
  library.markDirty();
  renderConfiguration();
  return true;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  clearErrors();
  try {
    const calculation = calculate({
      si: Number(element<HTMLInputElement>('si').value),
      ip: Number(element<HTMLInputElement>('ip').value),
      sf: Number(element<HTMLInputElement>('sf').value),
    });
    const preferred = calculation.segmentOptions.find(option => option.count === pattern.geometry.segments && option.feasible)
      ?? calculation.segmentOptions.find(option => option.feasible)!;
    confirmGeometry(createGeometry(calculation, preferred.count));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to calculate this yoke.';
    element('calculation-error').textContent = message;
    if (error instanceof PlanError && error.field) {
      element(`${error.field}-error`).textContent = message;
      element<HTMLInputElement>(error.field).setAttribute('aria-invalid', 'true');
      element<HTMLInputElement>(error.field as InputField).focus();
    }
  }
});

segments.addEventListener('change', () => {
  const geometry = createGeometry(pattern.geometry.calculation, Number(segments.value));
  if (!confirmGeometry(geometry)) segments.value = String(pattern.geometry.segments);
});

visible.addEventListener('change', () => {
  const value = Number(visible.value);
  if (!Number.isSafeInteger(value) || value < 1 || value > pattern.geometry.segments) {
    element('visible-error').textContent = `Choose 1 to ${pattern.geometry.segments} visible segments.`;
    visible.value = String(pattern.visibleSegments);
    return;
  }
  element('visible-error').textContent = '';
  pattern.visibleSegments = value;
  library.markDirty();
  preview.render();
});

element('full-circle').addEventListener('click', () => {
  if (pattern.visibleSegments !== pattern.geometry.segments) library.markDirty();
  pattern.visibleSegments = pattern.geometry.segments;
  visible.value = String(pattern.visibleSegments);
  element('visible-error').textContent = '';
  preview.render();
});

element('add-color').addEventListener('click', () => {
  addColor(pattern, element<HTMLInputElement>('new-color').value);
  library.markDirty();
  renderPalette();
  element('status').textContent = 'Color added and selected.';
});

element<HTMLInputElement>('background').addEventListener('input', event => {
  const value = (event.target as HTMLInputElement).value;
  if (pattern.background !== value) library.markDirty();
  pattern.background = value;
  updateColors();
});
form.addEventListener('input', () => library.markDirty());

for (const field of ['si', 'ip', 'sf'] as const) {
  element<HTMLInputElement>(field).value = String(pattern.geometry.calculation[field]);
}
element<HTMLInputElement>('background').value = pattern.background;
renderConfiguration();
renderPalette();
void library.initialize();
