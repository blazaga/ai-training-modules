import { z } from 'zod';
import { patchSchema } from './patch-schema.js';

const fields = z.object({
  title: z.string(),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
});

describe('patchSchema', () => {
  it('does NOT fill defaults for omitted fields (the bug .partial() has)', () => {
    expect(patchSchema(fields).parse({ title: 'x' })).toEqual({ title: 'x' });
  });

  it('control: .partial() DOES fill them, which is why the helper exists', () => {
    // If this starts failing after a zod upgrade, .partial() changed behaviour:
    // re-evaluate whether the helper is still needed.
    expect(fields.partial().parse({ title: 'x' })).toEqual({
      title: 'x',
      body: '',
      tags: [],
    });
  });

  it('keeps field validation', () => {
    expect(patchSchema(fields).safeParse({ title: 1 }).success).toBe(false);
  });

  it('rejects an empty patch', () => {
    expect(patchSchema(fields).safeParse({}).success).toBe(false);
  });
});
