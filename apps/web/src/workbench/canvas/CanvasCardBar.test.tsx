import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasCardBar } from './CanvasCardBar';

interface ButtonProps {
  role?: string;
  onClick(): void;
  'aria-pressed'?: boolean;
  children?: React.ReactNode;
}

describe('CanvasCardBar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders canvas cards and switches active canvas on click', () => {
    const onActiveCanvasChange = vi.fn();
    const element = CanvasCardBar({
      canvasOrder: ['canvas-1', 'storyboard'],
      activeCanvasId: 'canvas-1',
      onActiveCanvasChange,
      onCreateCanvas: async () => undefined,
      onRenameCanvas: async () => undefined,
      onDeleteCanvas: async () => undefined,
      onReorderCanvases: async () => undefined
    });

    buttonByText(element, 'storyboard').props.onClick();

    expect(buttonByText(element, 'canvas-1').props['aria-pressed']).toBe(true);
    expect(onActiveCanvasChange).toHaveBeenCalledWith('storyboard');
  });

  it('renders canvas menu actions for new rename and delete', () => {
    const onCreateCanvas = vi.fn(async () => undefined);
    const onRenameCanvas = vi.fn(async () => undefined);
    const onDeleteCanvas = vi.fn(async () => undefined);
    vi.stubGlobal('prompt', vi.fn(() => 'renamed'));
    vi.stubGlobal('confirm', vi.fn(() => true));
    const element = CanvasCardBar({
      canvasOrder: ['canvas-1'],
      activeCanvasId: 'canvas-1',
      onActiveCanvasChange: () => undefined,
      onCreateCanvas,
      onRenameCanvas,
      onDeleteCanvas,
      onReorderCanvases: async () => undefined
    });

    menuItemByText(element, 'New Canvas').props.onClick();
    menuItemByText(element, 'Rename').props.onClick();
    menuItemByText(element, 'Delete').props.onClick();

    expect(onCreateCanvas).toHaveBeenCalled();
    expect(onRenameCanvas).toHaveBeenCalledWith({ canvasId: 'canvas-1', nextCanvasId: 'renamed' });
    expect(onDeleteCanvas).toHaveBeenCalledWith({ canvasId: 'canvas-1' });
  });
});

function buttonByText(element: React.ReactElement, text: string): React.ReactElement<ButtonProps> {
  const button = elements(element).find((item) => (
    item.type === 'button'
    && textContent(item) === text
  ));
  if (!button) {
    throw new Error(`Expected button: ${text}`);
  }
  return button as React.ReactElement<ButtonProps>;
}

function menuItemByText(element: React.ReactElement, text: string): React.ReactElement<ButtonProps> {
  const item = elements(element).find((candidate) => (
    candidate.type === 'button'
    && candidate.props.role === 'menuitem'
    && textContent(candidate) === text
  ));
  if (!item) {
    throw new Error(`Expected menu item: ${text}`);
  }
  return item as React.ReactElement<ButtonProps>;
}

function elements(node: React.ReactNode): Array<React.ReactElement<{ children?: React.ReactNode; role?: unknown }>> {
  if (!React.isValidElement(node)) {
    return [];
  }
  const element = node as React.ReactElement<{ children?: React.ReactNode; role?: unknown }>;
  return [
    element,
    ...React.Children.toArray(element.props.children).flatMap(elements)
  ];
}

function textContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (!React.isValidElement(node)) {
    return '';
  }
  return React.Children.toArray((node.props as { children?: React.ReactNode }).children).map(textContent).join('');
}
