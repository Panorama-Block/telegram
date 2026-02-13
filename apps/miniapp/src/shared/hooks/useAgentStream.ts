'use client';

import { useCallback, useRef, useState } from 'react';
import { AgentsClient, type ChatOptions } from '@/clients/agentsClient';

// ── SSE event payloads ──

interface StatusEvent {
  step: string;
  label?: string;
  agent?: string;
  confidence?: number;
  tool?: string;
  ts: number;
}

interface TokenEvent {
  t: string;
}

interface ToolIOEvent {
  tool: string;
  output: string;
  ts: number;
}

export interface StreamDoneEvent {
  agent: string;
  nodes: string[];
  metadata: Record<string, unknown>;
  response: string;
  costs: { total_usd: number };
}

interface StreamErrorEvent {
  message: string;
}

// ── Thought step for UI ──

export interface ThoughtStep {
  id: string;
  label: string;
  status: 'active' | 'done';
  tool?: string;
  toolOutput?: string;
  ts: number;
}

// ── Hook state ──

export interface AgentStreamState {
  thoughts: ThoughtStep[];
  tokens: string;
  isStreaming: boolean;
  isDone: boolean;
  error: string | null;
  result: StreamDoneEvent | null;
}

const agentsClient = new AgentsClient();

export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>({
    thoughts: [],
    tokens: '',
    isStreaming: false,
    isDone: false,
    error: null,
    result: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setState({
      thoughts: [],
      tokens: '',
      isStreaming: false,
      isDone: false,
      error: null,
      result: null,
    });
  }, []);

  const send = useCallback(
    async (params: {
      message: string;
      userId: string;
      conversationId: string;
      walletAddress?: string;
      jwt?: string;
    }) => {
      // Reset state for new message
      setState({
        thoughts: [],
        tokens: '',
        isStreaming: true,
        isDone: false,
        error: null,
        result: null,
      });

      // Abort any existing stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const opts: ChatOptions = {};
        if (params.jwt) opts.jwt = params.jwt;

        const res = await agentsClient.chatStream(
          {
            message: { role: 'user', content: params.message },
            user_id: params.userId,
            conversation_id: params.conversationId,
            wallet_address: params.walletAddress ?? 'default',
            metadata: {
              source: 'miniapp-chat',
              sent_at: new Date().toISOString(),
            },
          },
          opts,
        );

        if (!res.body) {
          throw new Error('Response body is null — streaming not supported');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          if (controller.signal.aborted) break;

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() ?? '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                processEvent(currentEvent, data, setState);
              } catch {
                // Skip malformed JSON
              }
              currentEvent = '';
            }
          }
        }

        // If we never got a done event, mark as done now
        setState((prev) => {
          if (!prev.isDone && prev.isStreaming) {
            return { ...prev, isStreaming: false, isDone: true };
          }
          return prev;
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof Error ? err.message : 'Stream failed';
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: message,
        }));
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  return { ...state, send, cancel, reset };
}

// ── Event dispatcher ──

function processEvent(
  event: string,
  data: unknown,
  setState: React.Dispatch<React.SetStateAction<AgentStreamState>>,
) {
  switch (event) {
    case 'status': {
      const ev = data as StatusEvent;
      setState((prev) => {
        // Mark the previous active thought as done
        const thoughts = prev.thoughts.map((t) =>
          t.status === 'active' ? { ...t, status: 'done' as const } : t,
        );
        // Add new thought step
        thoughts.push({
          id: `${ev.step}-${ev.ts}`,
          label: ev.label ?? ev.step,
          status: 'active',
          tool: ev.tool,
          ts: ev.ts,
        });
        return { ...prev, thoughts };
      });
      break;
    }

    case 'token': {
      const ev = data as TokenEvent;
      setState((prev) => ({
        ...prev,
        tokens: prev.tokens + ev.t,
      }));
      break;
    }

    case 'tool_io': {
      const ev = data as ToolIOEvent;
      setState((prev) => {
        const thoughts = prev.thoughts.map((t) =>
          t.tool === ev.tool && t.status === 'active'
            ? { ...t, toolOutput: ev.output, status: 'done' as const }
            : t,
        );
        return { ...prev, thoughts };
      });
      break;
    }

    case 'done': {
      const ev = data as StreamDoneEvent;
      setState((prev) => ({
        ...prev,
        thoughts: prev.thoughts.map((t) => ({
          ...t,
          status: 'done' as const,
        })),
        isStreaming: false,
        isDone: true,
        result: ev,
      }));
      break;
    }

    case 'error': {
      const ev = data as StreamErrorEvent;
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: ev.message,
      }));
      break;
    }
  }
}
