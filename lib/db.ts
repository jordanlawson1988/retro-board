import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

function client(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return client()(strings, ...values);
}

type TransactionBuilder = Parameters<NeonQueryFunction<false, false>['transaction']>[0];

type TransactionOptions = Parameters<NeonQueryFunction<false, false>['transaction']>[1];

/**
 * Run several queries as one atomic, non-interactive transaction (Neon HTTP driver).
 * Pass a function that receives a tagged-template `txn` and returns the queries.
 */
export function sqlTransaction(
  build: Extract<TransactionBuilder, (...args: never[]) => unknown>,
  options?: TransactionOptions
) {
  return client().transaction(build, options);
}
