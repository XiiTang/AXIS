import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const legacyTokenNames = 'bg|bg-elevated|bg-panel|bg-soft|text|muted|subtle|border|accent|accent-strong|warn|danger|info|radius';
const legacyTokenPattern = new RegExp(`(?:var\\(--(?:${legacyTokenNames})\\)|--(?:${legacyTokenNames}):)`);

const styleFiles = [
  'apps/web/src/styles.css',
  'apps/web/src/workbench/ui/styles/base.css',
  'apps/web/src/workbench/ui/styles/controls.css',
  'apps/web/src/workbench/ui/styles/fields.css',
  'apps/web/src/workbench/ui/styles/menus.css',
  'apps/web/src/workbench/ui/styles/overlays.css',
  'apps/web/src/workbench/ui/styles/panels.css',
  'apps/web/src/workbench/ui/styles/tokens.css',
  'apps/web/src/workbench/ui/styles/workbench-patterns.css'
];
const rawColorLiteralPattern = /(?:#[0-9a-fA-F]{3,8}\b|rgb\(|oklch\()/;

describe('Workbench UI source contract', () => {
  it('uses only final Workbench UI token names in current stylesheets', () => {
    const violations = styleFiles.flatMap((file) => (
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(({ text }) => legacyTokenPattern.test(text))
        .map(({ file, line, text }) => `${file}:${line}:${text.trim()}`)
    ));

    expect(violations).toEqual([]);
  });

  it('keeps settings navigation control chrome in Workbench UI patterns', () => {
    const styles = readFileSync('apps/web/src/styles.css', 'utf8');

    expect(styles).not.toMatch(/\.settings-directory\s+button\b/);
    expect(styles).not.toMatch(/\.settings-directory\s+button\./);
    expect(styles).not.toMatch(/\.settings-directory\s+button:/);
  });

  it('keeps floating text editor chrome on Workbench UI primitives', () => {
    const styles = readFileSync('apps/web/src/styles.css', 'utf8');
    const source = readFileSync('apps/web/src/workbench/shell/FloatingTextEditorWindow.tsx', 'utf8');

    expect(source).not.toContain('<button');
    expect(styles).not.toMatch(/\.floating-text-editor-window\s*\{/);
    expect(styles).not.toMatch(/\.floating-text-editor-header\s+button\b/);
    expect(styles).not.toMatch(/\.floating-text-editor-header\s+button:/);
  });

  it('does not keep active-class compatibility for primitive pressed state', () => {
    const controls = readFileSync('apps/web/src/workbench/ui/styles/controls.css', 'utf8');
    const sources = [
      'apps/web/src/workbench/shell/FloatingDock.tsx',
      'apps/web/src/workbench/canvas/CanvasMinimapBar.tsx',
      'apps/web/src/workbench/canvas/CanvasFeedbackBar.tsx'
    ].map((file) => readFileSync(file, 'utf8')).join('\n');
    const terminalPanel = readFileSync('apps/web/src/workbench/terminal/TerminalPanel.tsx', 'utf8');

    expect(controls).not.toContain('.db-icon-button.active');
    expect(sources).not.toContain(" active'");
    expect(sources).not.toContain(' active"');
    expect(sources).not.toContain("'active'");
    expect(terminalPanel).not.toContain('terminal-panel__tab--active');
  });

  it('keeps Workbench spin animation owned by the UI base stylesheet only', () => {
    const styles = readFileSync('apps/web/src/styles.css', 'utf8');
    const base = readFileSync('apps/web/src/workbench/ui/styles/base.css', 'utf8');

    expect(base).toContain('.spin');
    expect(base).toContain('@keyframes db-spin');
    expect(styles).not.toMatch(/\.spin\s*\{/);
    expect(styles).not.toContain('@keyframes spin');
  });

  it('keeps Canvas feedback controls inside the compact floating bar geometry', () => {
    const styles = readFileSync('apps/web/src/styles.css', 'utf8');
    const feedbackBarRule = styles.match(/\.canvas-feedback-bar\s*\{[^}]*\}/)?.[0] ?? '';
    const feedbackNoteRule = styles.match(/\.canvas-feedback-note\s*\{[^}]*\}/)?.[0] ?? '';

    expect(feedbackBarRule).toContain('height: 32px;');
    expect(feedbackBarRule).toContain('padding: 3px 4px;');
    expect(feedbackNoteRule).toContain('height: 24px;');
    expect(feedbackNoteRule).toContain('min-height: 24px;');
    expect(feedbackNoteRule).toContain('padding: 0 7px;');
  });

  it('styles invalid state for every Workbench field control', () => {
    const fields = readFileSync('apps/web/src/workbench/ui/styles/fields.css', 'utf8');

    for (const selector of [
      '.db-input[aria-invalid="true"]',
      '.db-select[aria-invalid="true"]',
      '.db-textarea[aria-invalid="true"]',
      '.db-field--invalid .db-input',
      '.db-field--invalid .db-select',
      '.db-field--invalid .db-textarea'
    ]) {
      expect(fields).toContain(selector);
    }
  });

  it('does not keep non-canvas chrome raw colors in the feature stylesheet', () => {
    const styles = readFileSync('apps/web/src/styles.css', 'utf8');

    for (const rawChromeValue of [
      '#0b0d12',
      '#10141c',
      'rgb(23 26 31 / 98%)',
      'oklch(0.78 0.12 25)',
      '#8bd5a9',
      'rgb(10 12 12 / 72%)',
      'rgb(90 98 112 / 78%)',
      'rgb(20 22 26 / 94%)',
      'oklch(0.84 0.13 82)'
    ]) {
      expect(styles, rawChromeValue).not.toContain(rawChromeValue);
    }
  });

  it('does not keep raw color or shadow literals in non-Canvas feature CSS rules', () => {
    const styles = readFileSync('apps/web/src/styles.css', 'utf8');
    const violations = cssRuleBlocks(styles)
      .filter((rule) => !rule.selector.includes('.canvas-'))
      .flatMap((rule) => rule.lines
        .filter(({ text }) => rawColorLiteralPattern.test(text))
        .map(({ line, text }) => `${line}:${rule.selector}:${text.trim()}`));

    expect(violations).toEqual([]);
  });

  it('keeps Canvas chrome shadows tokenized and scoped to Workbench stat classes', () => {
    const styles = readFileSync('apps/web/src/styles.css', 'utf8');
    const canvasToolbar = readFileSync('apps/web/src/workbench/canvas/CanvasToolbar.tsx', 'utf8');
    const canvasChromeSelectors = new Set([
      '.canvas-card-bar',
      '.canvas-toolbar',
      '.canvas-minimap-bar',
      '.canvas-minimap-panel',
      '.canvas-empty-state'
    ]);
    const violations = cssRuleBlocks(styles)
      .filter((rule) => canvasChromeSelectors.has(rule.selector))
      .flatMap((rule) => rule.lines
        .filter(({ text }) => text.trim().startsWith('box-shadow:') && !text.trim().startsWith('box-shadow: var(--db-'))
        .map(({ line, text }) => `${line}:${rule.selector}:${text.trim()}`));

    expect(violations).toEqual([]);
    expect(styles).not.toMatch(/\.canvas-toolbar\s+span\b/);
    expect(canvasToolbar).toContain('canvas-toolbar__stat');
  });

  it('keeps empty actions and notifications on shared primitives without duplicate chrome', () => {
    const styles = readFileSync('apps/web/src/styles.css', 'utf8');
    const canvasEditor = readFileSync('apps/web/src/workbench/canvas/CanvasEditor.tsx', 'utf8');
    const workbenchApp = readFileSync('apps/web/src/workbench/WorkbenchApp.tsx', 'utf8');
    const notificationStack = readFileSync('apps/web/src/workbench/shell/NotificationStack.tsx', 'utf8');

    expect(styles).not.toMatch(/\.empty-action\b/);
    expect(canvasEditor).not.toContain('className="empty-action"');
    expect(workbenchApp).not.toContain('className="empty-action"');
    expect(styles).not.toMatch(/\.notification\s*\{/);
    expect(notificationStack).not.toContain('className="notification"');
  });

  it('does not keep unused stylesheet fragments from removed Workbench UI paths', () => {
    const styles = readFileSync('apps/web/src/styles.css', 'utf8');

    for (const selector of [
      '.settings-list',
      '.settings-edit-card-header',
      '.settings-model-card-footer',
      '.integration-confirm-backdrop',
      '.integration-confirm-dialog',
      '.integration-confirm-close'
    ]) {
      expect(styles).not.toContain(selector);
    }
  });
});

function cssRuleBlocks(styles: string): Array<{
  selector: string;
  lines: Array<{ line: number; text: string }>;
}> {
  const rules: Array<{
    selector: string;
    lines: Array<{ line: number; text: string }>;
  }> = [];
  let selector: string | undefined;
  let lines: Array<{ line: number; text: string }> = [];
  styles.split('\n').forEach((text, index) => {
    if (selector === undefined) {
      if (text.includes('{')) {
        selector = text.slice(0, text.indexOf('{')).trim();
        lines = [];
      }
      return;
    }
    if (text.includes('}')) {
      rules.push({ selector, lines });
      selector = undefined;
      lines = [];
      return;
    }
    lines.push({ line: index + 1, text });
  });
  return rules;
}
