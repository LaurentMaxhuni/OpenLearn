/**
 * The persistence package deliberately exposes a very small SQL boundary. It
 * keeps PostgreSQL row types and the application/domain packages separate and
 * makes transaction behavior testable without a live database.
 */
export type SqlRow = Record<string, unknown>;

export interface SqlResult<Row extends SqlRow = SqlRow> {
  readonly rows: readonly Row[];
  readonly rowCount: number | null;
}

export interface SqlClient {
  query<Row extends SqlRow = SqlRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
}

export interface SqlConnection extends SqlClient {
  release(): void;
}

export interface SqlPool extends SqlClient {
  connect(): Promise<SqlConnection>;
  end(): Promise<void>;
}
