/**
 * EmDashSmoother tests — the deterministic enforcement of cl2en's
 * hardest contract line ("No em dashes in the output"). The model gets
 * it right statistically; the smoother makes it absolute.
 */
import { EmDashSmoother } from './smooth';

function run(chunks: string[]): string {
  const s = new EmDashSmoother();
  return chunks.map((c) => s.feed(c)).join('') + s.flush();
}

describe('EmDashSmoother', () => {
  it('rewrites spaced em dashes to comma joins', () => {
    expect(run(['The fix — such as it is — shipped.'])).toBe('The fix, such as it is, shipped.');
  });

  it('rewrites bare em dashes to commas', () => {
    expect(run(['(r7a, r7b—both failures)'])).toBe('(r7a, r7b,both failures)');
  });

  it('handles the dash split across frame boundaries', () => {
    expect(run(['The fix ', '— such as it is ', '— shipped.'])).toBe(
      'The fix, such as it is, shipped.'
    );
    expect(run(['The fix —', ' shipped.'])).toBe('The fix, shipped.');
    expect(run(['The fix ', '—', ' shipped.'])).toBe('The fix, shipped.');
  });

  it('passes clean text through unchanged, including hyphens and en dashes', () => {
    expect(run(['A well-known fix (2019–2021) shipped.'])).toBe(
      'A well-known fix (2019–2021) shipped.'
    );
  });

  it('flushes a trailing holdback that never became a dash', () => {
    expect(run(['The fix '])).toBe('The fix ');
    expect(run(['The fix', ' '])).toBe('The fix ');
  });

  it('drops a leading dash rather than starting output with a comma', () => {
    expect(run(['— and so it begins.'])).toBe('and so it begins.');
  });
});

describe('markdown-bold stripping (cl2en mechanical cleanup)', () => {
  it('strips paired double-asterisk emphasis', () => {
    expect(run(['**Bottom line:** the fix shipped.'])).toBe('Bottom line: the fix shipped.');
  });

  it('handles bold markers split across frame boundaries', () => {
    expect(run(['**Bo', 'ld label** rest.'])).toBe('Bold label rest.');
    expect(run(['*', '*Label**: done.'])).toBe('Label: done.');
  });

  it('leaves single asterisks alone', () => {
    expect(run(['Rated 5* by reviewers (see note *).'])).toBe('Rated 5* by reviewers (see note *).');
  });

  it('flushes a trailing lone asterisk that never became bold', () => {
    expect(run(['The fix shipped *'])).toBe('The fix shipped *');
  });
});
