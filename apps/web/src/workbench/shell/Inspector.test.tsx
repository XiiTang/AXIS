import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '@debrute/canvas-core';
import { DiagnosticList } from './Inspector';

describe('DiagnosticList', () => {
  it('keeps diagnostic icon, message, and code as direct grid children', () => {
    const html = renderToStaticMarkup(
      <DiagnosticList
        diagnostics={[{
          id: 'diag-1',
          source: 'project',
          severity: 'warning',
          code: 'missing_asset',
          message: 'Missing asset',
          filePath: 'briefs/scene.md'
        } satisfies Diagnostic]}
        onSelect={() => undefined}
      />
    );

    expect(html).toMatch(/<button[^>]*class="[^"]*diagnostic warning[^"]*"[^>]*><svg[\s\S]*<\/svg><span>Missing asset<\/span><small>briefs\/scene\.md \/ missing_asset<\/small><\/button>/);
    expect(html).not.toContain('db-button__label');
  });
});
