/**
 * Claudish corpus miner — turn-final tagging (2026-09-02).
 *
 * The block Ian actually reads is the LAST main-chain assistant text
 * before his next typed turn, or before the session ends. Everything
 * else an agent emits while working (narration between tool calls,
 * sidechain output, every block of a subagent transcript, whose final
 * message is addressed to the parent agent) is mid-work. The tracker
 * mutates the chunk records it is handed so the miner's dedup and caps
 * see the flag without a second pass.
 */
export interface TurnFinalChunk {
  turnFinal: boolean;
}

export class TurnFinalTracker {
  private pending: TurnFinalChunk[] = [];
  private blocks = 0;
  private finals = 0;
  constructor(private readonly options: { subagent?: boolean } = {}) {}

  /** A main-chain assistant text block replaces the pending candidate; sidechain blocks never qualify. */
  onAssistantChunks(chunks: TurnFinalChunk[], sidechain: boolean): void {
    this.blocks++;
    if (sidechain || this.options.subagent) return;
    this.pending = chunks;
  }

  /** A typed human turn on the main chain closes the agent's turn: the pending block was the reply. */
  onHumanTurn(sidechain: boolean): void {
    if (sidechain || this.options.subagent) return;
    this.mark();
  }

  /** Session end: the agent paused on its last block and nobody replied in this file. */
  end(): void {
    if (this.options.subagent) return;
    this.mark();
  }

  stats(): { assistantBlocks: number; turnFinalBlocks: number } {
    return { assistantBlocks: this.blocks, turnFinalBlocks: this.finals };
  }

  private mark(): void {
    if (this.pending.length === 0) return;
    for (const c of this.pending) c.turnFinal = true;
    this.finals++;
    this.pending = [];
  }
}
