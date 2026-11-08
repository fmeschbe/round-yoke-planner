import { describe, expect, it } from 'vitest';
import { catalogs, preferredLanguage, t } from './i18n';
import { calculate, PlanError } from './yoke';

describe('localization', () => {
  it('selects German browser variants, falls back to English, and honors valid preferences', () => {
    expect(preferredLanguage(null, 'de-DE')).toBe('de');
    expect(preferredLanguage(null, 'de-AT')).toBe('de');
    expect(preferredLanguage(null, 'de')).toBe('de');
    expect(preferredLanguage(null, 'fr-FR')).toBe('en');
    expect(preferredLanguage('en', 'de-DE')).toBe('en');
    expect(preferredLanguage('de', 'en-US')).toBe('de');
    expect(preferredLanguage('unsupported', 'de-CH')).toBe('de');
    expect(preferredLanguage(null, 'nb-NO')).toBe('nb');
    expect(preferredLanguage(null, 'no-NO')).toBe('nb');
    expect(preferredLanguage(null, 'nb')).toBe('nb');
    expect(preferredLanguage(null, 'nn-NO')).toBe('en');
    expect(preferredLanguage('nb', 'en-US')).toBe('nb');
    expect(preferredLanguage('en', 'nb-NO')).toBe('en');
  });

  it('keeps translation interpolation compatible across languages', () => {
    for (const catalog of [catalogs.de, catalogs.nb]) {
      for (const [key, value] of Object.entries(catalog)) {
        expect(value.match(/\{\w+\}/g)?.sort() ?? [], key).toEqual(key.match(/\{\w+\}/g)?.sort() ?? []);
      }
    }
    expect(t('Choose 1 to {count} visible segments.', { count: 4 }, 'de'))
      .toBe('Wähle zwischen 1 und 4 sichtbaren Segmenten.');
    expect(t('Choose 1 to {count} visible segments.', { count: 4 }, 'nb'))
      .toBe('Velg mellom 1 og 4 synlige segmenter.');
    const name = '<b>$& {count}</b>';
    expect(t('Delete the saved copy of "{name}"? This cannot be undone.', { name }, 'de')).toContain(name);
  });

  it('retains calculator error fields and parameters for translation at display time', () => {
    try {
      calculate({ si: 8, ip: 2, sf: 15 });
      throw new Error('Expected invalid geometry');
    } catch (error) {
      expect(error).toBeInstanceOf(PlanError);
      const problem = error as PlanError;
      expect(problem.field).toBe('sf');
      expect(t(problem.key, problem.parameters, 'de')).toContain('durch 4 Maschen');
      expect(t(problem.key, problem.parameters, 'en')).toContain('divisible by 4 stitches');
    }
  });
});
