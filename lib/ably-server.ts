import Ably from 'ably';

if (!process.env.ABLY_API_KEY) {
  throw new Error('ABLY_API_KEY environment variable is not set');
}

export const ablyServer = new Ably.Rest(process.env.ABLY_API_KEY);
