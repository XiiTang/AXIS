import { Buffer } from 'node:buffer';
import type { TerminalDataChunk } from '@debrute/app-protocol';

export interface TerminalReplayBufferOptions {
  maxLines: number;
  maxBytes: number;
}

export class TerminalReplayBuffer {
  private nextSequence = 1;
  private chunks: TerminalDataChunk[] = [];
  private lineCount = 0;
  private byteCount = 0;

  constructor(private readonly options: TerminalReplayBufferOptions) {}

  append(data: string): TerminalDataChunk {
    const chunk = { sequence: this.nextSequence, data };
    this.nextSequence += 1;
    this.chunks.push({ ...chunk });
    this.lineCount += countLogicalLines(data);
    this.byteCount += Buffer.byteLength(data, 'utf8');
    this.trim();
    return chunk;
  }

  snapshot(): { chunks: TerminalDataChunk[]; lastSequence: number } {
    return {
      chunks: this.chunks.map((chunk) => ({ ...chunk })),
      lastSequence: this.nextSequence - 1
    };
  }

  private trim(): void {
    while (
      this.chunks.length > 1
      && (this.lineCount > this.options.maxLines || this.byteCount > this.options.maxBytes)
    ) {
      const removed = this.chunks.shift();
      if (!removed) {
        return;
      }
      this.lineCount -= countLogicalLines(removed.data);
      this.byteCount -= Buffer.byteLength(removed.data, 'utf8');
    }
    const onlyChunk = this.chunks[0];
    if (onlyChunk && (this.lineCount > this.options.maxLines || this.byteCount > this.options.maxBytes)) {
      onlyChunk.data = trimDataToCaps(onlyChunk.data, this.options.maxLines, this.options.maxBytes);
      this.lineCount = countLogicalLines(onlyChunk.data);
      this.byteCount = Buffer.byteLength(onlyChunk.data, 'utf8');
    }
  }
}

function countLogicalLines(data: string): number {
  return Math.max(1, data.split('\n').length - 1);
}

function trimDataToCaps(data: string, maxLines: number, maxBytes: number): string {
  return trimToUtf8ByteCap(trimToLineCap(data, maxLines), maxBytes);
}

function trimToLineCap(data: string, maxLines: number): string {
  const lineCount = countLogicalLines(data);
  if (lineCount <= maxLines) {
    return data;
  }
  let start = 0;
  for (let remaining = lineCount - maxLines; remaining > 0; remaining -= 1) {
    const newlineIndex = data.indexOf('\n', start);
    if (newlineIndex < 0) {
      return data;
    }
    start = newlineIndex + 1;
  }
  return data.slice(start);
}

function trimToUtf8ByteCap(data: string, maxBytes: number): string {
  if (Buffer.byteLength(data, 'utf8') <= maxBytes) {
    return data;
  }
  let bytes = 0;
  let start = data.length;
  for (const char of [...data].reverse()) {
    const charBytes = Buffer.byteLength(char, 'utf8');
    if (bytes + charBytes > maxBytes) {
      break;
    }
    bytes += charBytes;
    start -= char.length;
  }
  return data.slice(start);
}
