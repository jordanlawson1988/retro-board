import {
  CREATE_BOARD_FAILED,
  CREATE_BOARD_TIMED_OUT,
  CREATE_BOARD_TIMEOUT_MS,
  CREATE_BOARD_UNREACHABLE,
} from '@/lib/constants/create-board';

export { CREATE_BOARD_TIMEOUT_MS };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface PostNewBoardOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * POST /api/boards with a time limit that also covers reading the response body.
 * Resolves with the parsed success body. Rejects with an Error whose message is safe to show:
 * one of the create-board constants, or the server's own `error` string.
 */
export async function postNewBoard(
  body: unknown,
  opts: PostNewBoardOptions = {}
): Promise<{ participantId: string | null }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? CREATE_BOARD_TIMEOUT_MS;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(CREATE_BOARD_TIMED_OUT));
      controller.abort();
    }, timeoutMs);
  });

  const work = async (): Promise<{ participantId: string | null }> => {
    let res: Response;
    try {
      res = await fetchImpl('/api/boards', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new Error(CREATE_BOARD_UNREACHABLE);
    }

    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      throw new Error(CREATE_BOARD_FAILED);
    }

    if (!res.ok) {
      const serverError = (parsed as { error?: unknown } | null)?.error;
      throw new Error(typeof serverError === 'string' && serverError ? serverError : CREATE_BOARD_FAILED);
    }
    if (!parsed || typeof parsed !== 'object') throw new Error(CREATE_BOARD_FAILED);
    return parsed as { participantId: string | null };
  };

  try {
    return await Promise.race([work(), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}
