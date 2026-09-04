import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chatStream: vi.fn(),
  chatStreamWithFiles: vi.fn(),
}));

vi.mock('@/clients/agentsClient', () => ({
  AgentsClient: class {
    chatStream(...args: unknown[]) {
      return mocks.chatStream(...args);
    }

    chatStreamWithFiles(...args: unknown[]) {
      return mocks.chatStreamWithFiles(...args);
    }
  },
}));

import { useAgentStream } from '@/shared/hooks/useAgentStream';

const DONE_PAYLOAD = {
  agent: 'zico',
  nodes: ['final'],
  metadata: {},
  response: 'This is the complete final response.',
  response_mode: 'fast' as const,
  costs: { total_usd: 0.001 },
};

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function successfulResponse(chunks: string[]) {
  return Promise.resolve({
    body: streamFromChunks(chunks),
  });
}

async function sendTestMessage(
  result: ReturnType<typeof renderHook<typeof useAgentStream>>['result'],
) {
  await act(async () => {
    await result.current.send({
      message: 'Hi Zico! What should I buy today?',
      userId: 'user-123',
      conversationId: 'conversation-123',
      jwt: 'test-jwt',
      responseMode: 'fast',
    });
  });
}

describe('useAgentStream SSE framing contract', () => {
  beforeEach(() => {
    mocks.chatStream.mockReset();
    mocks.chatStreamWithFiles.mockReset();
  });

  it('captures done when event and data arrive in separate reader.read() calls', async () => {
    mocks.chatStream.mockReturnValue(
      successfulResponse([
        'event: done\n',
        `data: ${JSON.stringify(DONE_PAYLOAD)}\n\n`,
      ]),
    );

    const { result } = renderHook(() => useAgentStream());

    await sendTestMessage(result);

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isDone).toBe(true);
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.response).toBe(DONE_PAYLOAD.response);
  });

  it('parses an SSE response split at every byte boundary', async () => {
    const wire =
      'event: token\n' +
      'data: {"t":"partial streamed text"}\n\n' +
      'event: done\n' +
      `data: ${JSON.stringify(DONE_PAYLOAD)}\n\n`;

    const chunks = Array.from(new TextEncoder().encode(wire), (byte) =>
      new TextDecoder().decode(Uint8Array.of(byte)),
    );

    mocks.chatStream.mockReturnValue(successfulResponse(chunks));

    const { result } = renderHook(() => useAgentStream());

    await sendTestMessage(result);

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isDone).toBe(true);
    expect(result.current.tokens).toBe('partial streamed text');
    expect(result.current.result?.response).toBe(DONE_PAYLOAD.response);
  });

  it('parses multiple SSE events delivered in one network chunk', async () => {
    mocks.chatStream.mockReturnValue(
      successfulResponse([
        'event: token\n' +
          'data: {"t":"Hello "}\n\n' +
          'event: token\n' +
          'data: {"t":"world"}\n\n' +
          'event: done\n' +
          `data: ${JSON.stringify(DONE_PAYLOAD)}\n\n`,
      ]),
    );

    const { result } = renderHook(() => useAgentStream());

    await sendTestMessage(result);

    expect(result.current.error).toBeNull();
    expect(result.current.tokens).toBe('Hello world');
    expect(result.current.isDone).toBe(true);
    expect(result.current.result?.response).toBe(DONE_PAYLOAD.response);
  });

  it('accepts CRLF SSE framing', async () => {
    mocks.chatStream.mockReturnValue(
      successfulResponse([
        'event: token\r\n' +
          'data: {"t":"Hello"}\r\n\r\n' +
          'event: done\r\n' +
          `data: ${JSON.stringify(DONE_PAYLOAD)}\r\n\r\n`,
      ]),
    );

    const { result } = renderHook(() => useAgentStream());

    await sendTestMessage(result);

    expect(result.current.error).toBeNull();
    expect(result.current.tokens).toBe('Hello');
    expect(result.current.isDone).toBe(true);
    expect(result.current.result?.response).toBe(DONE_PAYLOAD.response);
  });

  it('buffers a partial data line until the JSON payload is complete', async () => {
    const json = JSON.stringify(DONE_PAYLOAD);
    const splitAt = Math.floor(json.length / 2);

    mocks.chatStream.mockReturnValue(
      successfulResponse([
        'event: done\n' + `data: ${json.slice(0, splitAt)}`,
        `${json.slice(splitAt)}\n\n`,
      ]),
    );

    const { result } = renderHook(() => useAgentStream());

    await sendTestMessage(result);

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isDone).toBe(true);
    expect(result.current.result?.response).toBe(DONE_PAYLOAD.response);
  });

  it('treats EOF before an explicit done event as an error', async () => {
    mocks.chatStream.mockReturnValue(
      successfulResponse([
        'event: token\n',
        'data: {"t":"partial only"}\n\n',
      ]),
    );

    const { result } = renderHook(() => useAgentStream());

    await sendTestMessage(result);

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.tokens).toBe('partial only');
    expect(result.current.result).toBeNull();
    expect(result.current.isDone).toBe(false);
    expect(result.current.error).toBe('stream ended before done event');
  });
});
