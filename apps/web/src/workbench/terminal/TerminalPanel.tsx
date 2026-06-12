import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import type { TerminalSessionView, WorkbenchApiClient } from '@debrute/app-protocol';
import { useXtermTerminal } from './useXtermTerminal';
import { createTerminalMetadataEventHandler } from './terminalMetadataEvents';
import {
  beginClosingTerminalSession,
  finishClosingTerminalSession,
  isTerminalSessionClosing,
  replaceTerminalSession,
  selectNextTerminalSession,
  shouldShowTerminalEmptyState,
  type TerminalPanelState
} from './terminalPanelState';

export interface TerminalPanelProps {
  api: WorkbenchApiClient;
  requestedCwdProjectRelativePath: string | null;
  onRequestedCwdConsumed(): void;
}

export function TerminalPanel({
  api,
  requestedCwdProjectRelativePath,
  onRequestedCwdConsumed
}: TerminalPanelProps): React.ReactElement {
  const [state, setState] = useState<TerminalPanelState>({
    sessions: [],
    activeSessionId: null,
    isLoading: true,
    error: null,
    closingSessionIds: []
  });
  const closingSessionIdsRef = useRef(new Set<string>());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeSession = useMemo(
    () => state.sessions.find((session) => session.id === state.activeSessionId) ?? null,
    [state.activeSessionId, state.sessions]
  );
  const backgroundTerminalSessionIdsKey = useMemo(
    () => state.sessions
      .map((session) => session.id)
      .filter((terminalId) => terminalId !== state.activeSessionId)
      .join('\n'),
    [state.activeSessionId, state.sessions]
  );
  const showError = useCallback((error: Error) => {
    setState((current) => ({ ...current, error: error.message }));
  }, []);
  const updateSession = useCallback((session: TerminalSessionView) => {
    setState((current) => ({
      ...current,
      sessions: replaceTerminalSession(current.sessions, session),
      activeSessionId: current.activeSessionId ?? session.id
    }));
  }, []);
  const removeSession = useCallback((terminalId: string) => {
    closingSessionIdsRef.current.delete(terminalId);
    setState((current) => {
      const sessions = current.sessions.filter((session) => session.id !== terminalId);
      return {
        ...current,
        sessions,
        closingSessionIds: current.closingSessionIds.filter((id) => id !== terminalId),
        activeSessionId: current.activeSessionId === terminalId
          ? selectNextTerminalSession(current.sessions, terminalId)
          : current.activeSessionId
      };
    });
  }, []);

  const createSession = useCallback(async (cwdProjectRelativePath = '') => {
    setState((current) => ({ ...current, error: null }));
    const result = await api.createTerminalSession({
      cwdProjectRelativePath
    });
    setState((current) => ({
      ...current,
      sessions: replaceTerminalSession(current.sessions, result.session),
      activeSessionId: result.session.id,
      isLoading: false
    }));
  }, [api]);

  useEffect(() => {
    let disposed = false;
    void api.listTerminalSessions().then(async (result) => {
      if (disposed) {
        return;
      }
      if (result.sessions.length === 0) {
        if (requestedCwdProjectRelativePath !== null) {
          setState((current) => ({ ...current, isLoading: false }));
          return;
        }
        await createSession('');
        return;
      }
      setState({
        sessions: result.sessions,
        activeSessionId: result.sessions[0]!.id,
        isLoading: false,
        error: null,
        closingSessionIds: []
      });
    }).catch((error: Error) => {
      if (!disposed) {
        setState((current) => ({ ...current, isLoading: false, error: error.message }));
      }
    });
    return () => {
      disposed = true;
    };
  }, [api, createSession]);

  useEffect(() => {
    if (!backgroundTerminalSessionIdsKey) {
      return;
    }
    const handleEvent = createTerminalMetadataEventHandler({
      onSessionUpdate: updateSession,
      onSessionClose: removeSession,
      onError: showError
    });
    const subscriptions = backgroundTerminalSessionIdsKey
      .split('\n')
      .map((terminalId) => api.subscribeTerminalEvents(terminalId, handleEvent, showError));
    return () => {
      for (const subscription of subscriptions) {
        subscription.close();
      }
    };
  }, [api, backgroundTerminalSessionIdsKey, removeSession, showError, updateSession]);

  useEffect(() => {
    if (requestedCwdProjectRelativePath === null) {
      return;
    }
    onRequestedCwdConsumed();
    void createSession(requestedCwdProjectRelativePath).catch(showError);
  }, [createSession, onRequestedCwdConsumed, requestedCwdProjectRelativePath, showError]);

  useXtermTerminal({
    api,
    session: activeSession,
    containerRef,
    onSessionUpdate: updateSession,
    onSessionClose: removeSession,
    onError: showError
  });

  const closeSession = useCallback((session: TerminalSessionView) => {
    if (closingSessionIdsRef.current.has(session.id)) {
      return;
    }
    closingSessionIdsRef.current.add(session.id);
    setState((current) => beginClosingTerminalSession(current, session.id));
    void api.closeTerminalSession({ terminalId: session.id }).then(() => {
      removeSession(session.id);
    }).catch((error: Error) => {
      closingSessionIdsRef.current.delete(session.id);
      setState((current) => finishClosingTerminalSession(current, session.id));
      showError(error);
    });
  }, [api, removeSession, showError]);

  const restartActiveSession = useCallback(() => {
    if (!activeSession) {
      return;
    }
    void api.restartTerminalSession({ terminalId: activeSession.id })
      .then((result) => updateSession(result.session))
      .catch(showError);
  }, [activeSession, api, showError, updateSession]);
  const showEmptyState = shouldShowTerminalEmptyState(state);

  return (
    <div className="terminal-panel">
      <div className="terminal-panel__toolbar">
        <div className="terminal-panel__tabs" role="tablist" aria-label="Terminal sessions">
          {state.sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              role="tab"
              aria-selected={session.id === state.activeSessionId}
              className={session.id === state.activeSessionId ? 'terminal-panel__tab terminal-panel__tab--active' : 'terminal-panel__tab'}
              onClick={() => setState((current) => ({ ...current, activeSessionId: session.id }))}
            >
              <span>{session.title}</span>
              {session.status === 'exited' || session.status === 'failed' ? (
                <small>{session.status}</small>
              ) : null}
            </button>
          ))}
        </div>
        <div className="terminal-panel__actions">
          <button type="button" aria-label="New Terminal" title="New Terminal" onClick={() => void createSession('').catch(showError)}>
            <Plus size={14} />
          </button>
          <button type="button" aria-label="Restart Terminal" title="Restart Terminal" disabled={!activeSession} onClick={restartActiveSession}>
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            aria-label="Close Terminal"
            title="Close Terminal"
            disabled={!activeSession || isTerminalSessionClosing(state, activeSession.id)}
            onClick={() => activeSession && closeSession(activeSession)}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {state.error ? <div className="terminal-panel__status">{state.error}</div> : null}
      {state.isLoading ? <div className="terminal-panel__status">Loading terminal</div> : null}
      {showEmptyState ? (
        <div className="terminal-panel__empty" data-testid="terminal-panel-empty-state">No terminal sessions</div>
      ) : (
        <div ref={containerRef} className="terminal-panel__surface" />
      )}
    </div>
  );
}
