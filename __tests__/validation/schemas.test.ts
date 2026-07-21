import { describe, it, expect } from 'vitest';
import { monetaryInputSchema, pixWebhookSchema } from '../../src/validation/schemas';

describe('Validation Schemas', () => {
  describe('monetaryInputSchema', () => {
    it('should parse valid monetary strings with dots', () => {
      expect(monetaryInputSchema.parse('10.50')).toBe(10.5);
    });

    it('should parse valid monetary strings with commas', () => {
      expect(monetaryInputSchema.parse('10,50')).toBe(10.5);
    });

    it('should parse valid numbers directly', () => {
      expect(monetaryInputSchema.parse(10.50)).toBe(10.5);
    });

    it('should fail on invalid strings', () => {
      expect(() => monetaryInputSchema.parse('abc')).toThrow();
    });

    it('should fail on negative numbers', () => {
      expect(() => monetaryInputSchema.parse('-10.50')).toThrow();
    });
  });

  describe('pixWebhookSchema', () => {
    it('should pass on a valid EFI webhook payload', () => {
      const payload = {
        pix: [
          {
            txid: 'd9b04fbb1c7a4ecf8dfecae101967292',
            valor: '10.00'
          }
        ]
      };
      const result = pixWebhookSchema.parse(payload);
      expect(result.pix![0].txid).toBe('d9b04fbb1c7a4ecf8dfecae101967292');
      expect(result.pix![0].valor).toBe(10);
    });

    it('should fail if txid is missing or empty in pix array', () => {
      const payload = {
        pix: [
          {
            valor: '10.00'
          }
        ]
      };
      expect(() => pixWebhookSchema.parse(payload)).toThrow();
    });

    it('should pass with an empty pix array (or empty payload)', () => {
      const payload = {};
      const result = pixWebhookSchema.parse(payload);
      expect(result.pix).toEqual([]);
    });
  });
});
