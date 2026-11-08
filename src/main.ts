import './styles.css';
import { errorText, initializeLocalization, onLanguageChange, setText, t } from './i18n';
import { Chart } from './chart';
import { DEFAULT_INPUTS, stitchSelections } from './calculator';
import { PlanLibrary } from './library';
import { Preview } from './preview';
import { calculate, createGeometry, PlanError, sameGeometry } from './yoke';
import type { Inputs } from './yoke';
import { addColor, applyGeometry, changeColor, createPattern, paint, removeColor } from './pattern';

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

initializeLocalization();

const form = element<HTMLFormElement>('calculator');
const segments = element<HTMLSelectElement>('segments');
const visible = element<HTMLInputElement>('visible-segments');
const pattern = createPattern(createGeometry(calculate(DEFAULT_INPUTS), 1));
const preview = new Preview(element('preview'), element('preview-description'), element('preview-mode'), pattern);
const chart = new Chart(element('chart'), pattern, (round, column) => {
  if (!paint(pattern, round, column)) return;
  library.markDirty();
  updateColors();
  setText(element('status'), 'Updated round {round}, column {column}.', { round, column: column + 1 });
});
const library = new PlanLibrary(pattern, () => {
  const calculation = pattern.geometry.calculation;
  renderInputs(calculation);
  element<HTMLInputElement>('background').value = pattern.background;
  clearErrors();
  renderConfiguration();
  renderPalette();
}, () => {
  const draft = readInputs();
  return (['si', 'ip', 'sf'] as const).some(field => draft[field] !== pattern.geometry.calculation[field]);
});

function readInputs(): Inputs {
  return {
    ip: Number(element<HTMLSelectElement>('ip').value),
    si: Number(element<HTMLSelectElement>('si').value),
    sf: Number(element<HTMLSelectElement>('sf').value),
  };
}

function renderInputs(draft: Inputs): void {
  const { values, options } = stitchSelections(draft, pattern.geometry.calculation);
  for (const field of ['ip', 'si', 'sf'] as const) {
    const select = element<HTMLSelectElement>(field);
    select.replaceChildren(...options[field].map(({ value, fromPlan }) => {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = fromPlan ? t('{count} (from current plan)', { count: value }) : String(value);
      return option;
    }));
    select.value = String(values[field]);
  }
}

function updateColors(): void {
  chart.updateColors();
  preview.updateColors();
}

function renderConfiguration(clearVisibleError = true): void {
  const { geometry } = pattern;
  const { calculation } = geometry;
  const results = element('results');
  results.replaceChildren();
  const total = document.createElement('div');
  total.className = 'round-total';
  const number = document.createElement('strong');
  number.textContent = String(calculation.rounds);
  const unit = document.createElement('span');
  unit.textContent = t('rounds to knit');
  total.append(number, unit);
  const detail = document.createElement('p');
  detail.className = 'result-detail';
  detail.textContent = t(calculation.interval === 1
    ? '{si} to {sf} stitches. {increases} increase rounds, every {interval} round.'
    : '{si} to {sf} stitches. {increases} increase rounds, every {interval} rounds.', {
    si: calculation.si, sf: calculation.sf, increases: calculation.increases, interval: calculation.interval,
  });
  const rowCounts = document.createElement('p');
  rowCounts.className = 'hint';
  const countGroups: string[] = [];
  for (const row of geometry.rows) {
    const previous = geometry.rows[row.round - 2];
    if (!previous || previous.stitches !== row.stitches) {
      countGroups.push(t('R{round}: {stitches}', { round: row.round, stitches: row.stitches }));
    }
  }
  rowCounts.textContent = countGroups.length <= 16
    ? t('Stitches per round (until the next change): {counts}.', { counts: countGroups.join(' / ') || t('no rounds') })
    : t('Hover a chart row number for its full-round stitch count.');
  results.append(total, detail, rowCounts);
  segments.replaceChildren(...calculation.segmentOptions.map(({ count, feasible }) => {
    const option = document.createElement('option');
    option.value = String(count);
    option.textContent = t(count === 1 ? '{count} segment' : '{count} segments', { count })
      + (feasible ? '' : t(' - exceeds 5,000 slots'));
    option.disabled = !feasible;
    return option;
  }));
  segments.value = String(geometry.segments);
  visible.max = String(geometry.segments);
  visible.value = String(pattern.visibleSegments);
  visible.disabled = calculation.rounds === 0;
  element<HTMLButtonElement>('full-circle').disabled = calculation.rounds === 0;
  if (clearVisibleError) setText(element('visible-error'), '');
  element('segment-description').textContent = t('Edit one of {count} repeated segments. Segment counts must divide every round.', { count: geometry.segments });
  element('chart-size').textContent = t('{columns} columns x {rounds} rounds', { columns: geometry.width, rounds: calculation.rounds });
  chart.render();
  preview.render();
}

function renderPalette(): void {
  const container = element('palette-colors');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'swatch clear-swatch';
  clear.textContent = t('Clear');
  clear.setAttribute('aria-label', t('Select clear'));
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
    select.setAttribute('aria-label', t('Select color {number}', { number: index + 1 }));
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
    edit.setAttribute('aria-label', t('Edit color {number}', { number: index + 1 }));
    edit.addEventListener('input', () => {
      if (color.value !== edit.value) library.markDirty();
      changeColor(pattern, color.id, edit.value);
      select.style.backgroundColor = edit.value;
      updateColors();
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-color';
    remove.setAttribute('aria-label', t('Remove color {number}', { number: index + 1 }));
    remove.title = t('Remove color {number}', { number: index + 1 });
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
      setText(element('status'), 'Color removed. Its stitches are now clear.');
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
  setText(element('calculation-error'), '');
  for (const field of ['si', 'ip', 'sf']) {
    setText(element(`${field}-error`), '');
    element(field).removeAttribute('aria-invalid');
  }
}

function confirmGeometry(geometry: typeof pattern.geometry): boolean {
  if (sameGeometry(pattern.geometry, geometry)) return true;
  if (pattern.cells.size && !window.confirm(t('Changing the yoke or repeating segments will clear your pattern. Keep the palette and continue?'))) {
    return false;
  }
  applyGeometry(pattern, geometry);
  renderInputs(readInputs());
  library.markDirty();
  renderConfiguration();
  return true;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  clearErrors();
  try {
    const calculation = calculate(readInputs());
    const preferred = calculation.segmentOptions.find(option => option.count === pattern.geometry.segments && option.feasible)
      ?? calculation.segmentOptions.find(option => option.feasible)!;
    confirmGeometry(createGeometry(calculation, preferred.count));
  } catch (error) {
    const message = () => errorText(error, 'Unable to calculate this yoke.');
    setText(element('calculation-error'), message);
    if (error instanceof PlanError && error.field) {
      setText(element(`${error.field}-error`), message);
      element<HTMLSelectElement>(error.field).setAttribute('aria-invalid', 'true');
      element<HTMLSelectElement>(error.field).focus();
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
    setText(element('visible-error'), 'Choose 1 to {count} visible segments.', { count: pattern.geometry.segments });
    visible.value = String(pattern.visibleSegments);
    return;
  }
  setText(element('visible-error'), '');
  pattern.visibleSegments = value;
  library.markDirty();
  preview.render();
});

element('full-circle').addEventListener('click', () => {
  if (pattern.visibleSegments !== pattern.geometry.segments) library.markDirty();
  pattern.visibleSegments = pattern.geometry.segments;
  visible.value = String(pattern.visibleSegments);
  setText(element('visible-error'), '');
  preview.render();
});

element('add-color').addEventListener('click', () => {
  addColor(pattern, element<HTMLInputElement>('new-color').value);
  library.markDirty();
  renderPalette();
  setText(element('status'), 'Color added and selected.');
});

element<HTMLInputElement>('background').addEventListener('input', event => {
  const value = (event.target as HTMLInputElement).value;
  if (pattern.background !== value) library.markDirty();
  pattern.background = value;
  updateColors();
});
form.addEventListener('change', () => {
  renderInputs(readInputs());
  clearErrors();
  library.markDirty();
});

onLanguageChange(() => {
  const scroll = element('chart');
  const { scrollLeft, scrollTop } = scroll;
  renderInputs(readInputs());
  renderConfiguration(false);
  renderPalette();
  scroll.scrollLeft = scrollLeft;
  scroll.scrollTop = scrollTop;
});

renderInputs(pattern.geometry.calculation);
element<HTMLInputElement>('background').value = pattern.background;
renderConfiguration();
renderPalette();
void library.initialize();
