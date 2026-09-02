/**
 * Turn-final tracker: the assistant block Ian actually reads is the LAST
 * main-chain assistant text before his next typed turn (or before the
 * session ends). Everything else is mid-work narration.
 */
import { TurnFinalTracker } from '../../../../scripts/claudish/lib/turn-final';

const chunk = (text: string) => ({ text, turnFinal: false });

describe('TurnFinalTracker', () => {
  it('marks only the last assistant block before a human turn', () => {
    const t = new TurnFinalTracker();
    const a = [chunk('checking the file')];
    const b = [chunk('here is what I found')];
    t.onAssistantChunks(a, false);
    t.onAssistantChunks(b, false);
    t.onHumanTurn(false);
    expect(a[0].turnFinal).toBe(false);
    expect(b[0].turnFinal).toBe(true);
  });
  it('marks the pending block at session end', () => {
    const t = new TurnFinalTracker();
    const a = [chunk('done, summary follows'), chunk('second chunk of it')];
    t.onAssistantChunks(a, false);
    t.end();
    expect(a.map((c) => c.turnFinal)).toEqual([true, true]);
  });
  it('ignores sidechain records and never marks subagent files', () => {
    const t = new TurnFinalTracker();
    const main = [chunk('main reply')];
    const side = [chunk('subagent chatter')];
    t.onAssistantChunks(main, false);
    t.onAssistantChunks(side, true);
    t.onHumanTurn(true); // a sidechain human turn is not Ian
    expect(main[0].turnFinal).toBe(false);
    t.onHumanTurn(false);
    expect(main[0].turnFinal).toBe(true);
    expect(side[0].turnFinal).toBe(false);
    const sub = new TurnFinalTracker({ subagent: true });
    const s = [chunk('final report to the parent agent')];
    sub.onAssistantChunks(s, false);
    sub.end();
    expect(s[0].turnFinal).toBe(false);
    expect(sub.stats()).toEqual({ assistantBlocks: 1, turnFinalBlocks: 0 });
  });
});
