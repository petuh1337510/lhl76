import { describe, expect, it } from 'vitest';
import { legacyProtocolReview } from './legacy-protocol-review';

describe('final import manual protocol queue', () => {
  it('retains all seven explicitly deferred protocols with explanations', () => {
    expect(Object.keys(legacyProtocolReview)).toHaveLength(7);
    for (const [id, note] of Object.entries(legacyProtocolReview)) {
      expect(id).toMatch(/^[a-f0-9-]{36}$/);
      expect(note.length).toBeGreaterThan(60);
    }
  });
  it('includes the new match whose contradictory events were not imported', () => {
    expect(legacyProtocolReview['c43a94e3-611f-40ae-8574-03cd07a23f5a']).toContain('не импортированы');
  });
});
