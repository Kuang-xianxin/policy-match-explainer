import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ResultsPage layout', () => {
  it('keeps a single prominent report generation action', () => {
    const source = readFileSync(new URL('./ResultsPage.vue', import.meta.url), 'utf8');
    const reportActionCount = source.match(/@click="doGenerateReport"/g)?.length ?? 0;

    expect(reportActionCount).toBe(1);
    expect(source).not.toContain('<button class="outline-button" :disabled="!appState.matchRun || isGeneratingReport"');
  });

  it('renders generated reports as markdown blocks instead of raw preformatted text', () => {
    const source = readFileSync(new URL('./ResultsPage.vue', import.meta.url), 'utf8');

    expect(source).toContain('renderReportMarkdown');
    expect(source).not.toContain('<pre v-if="appState.report">');
  });
});
