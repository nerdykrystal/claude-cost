import fs from "fs/promises";
import { H6Record } from "./schema.js";

/**
 * JSONL log writer for H6 records
 *
 * Appends H6 records to step-history.jsonl (or env var CC_H6_LOG_PATH).
 * Atomic-ish append using fs.appendFile; errors are propagated to caller
 * (which buffers on failure).
 */

/**
 * Get the log file path
 *
 * Priority:
 * 1. env CC_H6_LOG_PATH if set
 * 2. "step-history.jsonl" in process.cwd()
 */
function getLogPath(): string {
  return process.env.CC_H6_LOG_PATH || "step-history.jsonl";
}

/**
 * writeRecord - Append a single record to the JSONL log
 *
 * @param record H6Record to write
 * @throws On file I/O errors (EACCES, ENOSPC, etc.)
 */
export async function writeRecord(record: H6Record): Promise<void> {
  const path = getLogPath();
  const line = JSON.stringify(record) + "\n";

  await fs.appendFile(path, line, "utf-8");
}
