import { H6Record, H6RecoveryRecordSchema } from "./schema.js";

/**
 * In-process buffer for H6 records
 *
 * When log-write fails (EACCES, ENOSPC, etc.), records are buffered in-memory
 * up to cap=100. On next successful H6 invocation, flushBuffer drains the buffer
 * and emits h6_recovered record.
 *
 * Overflow behavior: drop oldest (FIFO) when at cap.
 */

let recordBuffer: H6Record[] = [];
const BUFFER_CAP = 100;

/**
 * bufferRecord - Add a record to the in-process buffer
 *
 * If buffer is at capacity, drops the oldest record (FIFO).
 */
export function bufferRecord(record: H6Record): void {
  if (recordBuffer.length >= BUFFER_CAP) {
    recordBuffer.shift(); // Drop oldest
  }
  recordBuffer.push(record);
}

/**
 * flushBuffer - Drain the buffer by writing all records
 *
 * Emits h6_recovered record after successful flush.
 * On writer failure, retains buffered records for next attempt.
 *
 * @param writer Async function to write each record; rejects on failure
 * @returns { flushed, prior, remaining } counts
 */
export async function flushBuffer(
  writer: (r: H6Record) => Promise<void>
): Promise<{ flushed: number; prior: number; remaining: number }> {
  const prior = recordBuffer.length;
  const toFlush = [...recordBuffer];

  try {
    for (const record of toFlush) {
      await writer(record);
    }

    // Successful flush; clear buffer and emit recovery record
    recordBuffer = [];

    const recoveryRecord = H6RecoveryRecordSchema.parse({
      ts_iso: new Date().toISOString(),
      kind: "h6_recovered",
      flushed_count: toFlush.length,
      prior_buffer_size: prior,
    });

    await writer(recoveryRecord);

    return {
      flushed: toFlush.length,
      prior,
      remaining: 0,
    };
  } catch (error) {
    // Write failed; retain buffered records for next attempt
    // Do NOT clear the buffer
    return {
      flushed: 0,
      prior,
      remaining: recordBuffer.length,
    };
  }
}

/**
 * getBufferSize - Return current buffer size (for testing)
 */
export function getBufferSize(): number {
  return recordBuffer.length;
}

/**
 * clearBuffer - Reset buffer to empty (for testing)
 */
export function clearBuffer(): void {
  recordBuffer = [];
}
