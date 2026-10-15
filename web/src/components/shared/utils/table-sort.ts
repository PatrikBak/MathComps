/**
 * How a table's rows are ordered: which column, and which way round.
 */
export type TableSort<TColumn extends string> = {
  /** The column. */
  by: TColumn
  /** Whether the smallest comes first. */
  ascending: boolean
}

/**
 * Works out the order after a column header is pressed.
 *
 * @param current - The order standing.
 * @param by - The column pressed.
 * @param startsAscending - Which way each column reads when it is first pressed, true where the smallest comes first.
 *
 * @returns The column already ordering the rows turned round; another one the way it first reads.
 */
export function nextSort<TColumn extends string>(
  current: TableSort<TColumn>,
  by: TColumn,
  startsAscending: Readonly<Record<TColumn, boolean>>
): TableSort<TColumn> {
  // The same column, turned round, or a new one from where it naturally starts
  return current.by === by
    ? { by, ascending: !current.ascending }
    : { by, ascending: startsAscending[by] }
}
