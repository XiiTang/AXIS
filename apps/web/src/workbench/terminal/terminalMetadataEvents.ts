import type { TerminalEvent, TerminalSessionView } from '@debrute/app-protocol';

export interface TerminalMetadataEventHandlerInput {
  onSessionUpdate(session: TerminalSessionView): void;
  onSessionClose(terminalId: string): void;
  onError(error: Error): void;
}

export function createTerminalMetadataEventHandler(
  input: TerminalMetadataEventHandlerInput
): (event: TerminalEvent) => void {
  return (event) => {
    if (event.type === 'status') {
      input.onSessionUpdate(event.session);
      return;
    }
    if (event.type === 'closed') {
      input.onSessionClose(event.terminalId);
      return;
    }
    if (event.type === 'error') {
      input.onError(new Error(event.message));
    }
  };
}
