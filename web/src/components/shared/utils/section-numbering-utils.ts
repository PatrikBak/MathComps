/**
 * Utility for generating hierarchical section numbering (e.g., "1", "1.1", "1.2.3").
 * Maintains state across multiple sections to produce consistent numbering.
 */
export class SectionNumberingGenerator {
  private levelCounters: number[] = []

  /**
   * Generate the next section number for the given level.
   * Automatically handles counter increments and resets for deeper levels.
   *
   * @param level - The hierarchy level (0-indexed: 0 = top level, 1 = first sublevel, etc.)
   * @returns The formatted section number (e.g., "1.2.3")
   */
  getNextNumber(level: number): string {
    // Expand counter array to accommodate current section's level
    while (this.levelCounters.length <= level) {
      this.levelCounters.push(0)
    }

    // Increment counter for current level to assign this section's number
    this.levelCounters[level] += 1

    // Reset all deeper level counters since we're starting a new branch at this level
    for (let i = level + 1; i < this.levelCounters.length; i++) {
      this.levelCounters[i] = 0
    }

    // Construct hierarchical section number by joining active counters (e.g., "1.2.3")
    return this.levelCounters
      .slice(0, level + 1)
      .filter((count) => count > 0)
      .join('.')
  }
}
