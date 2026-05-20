import { Injectable, Logger } from '@nestjs/common';

interface Rule {
  keywords: string[];
  category: string;
}

/**
 * Maps a transcript to a clip category via simple keyword matching.
 * Rules are evaluated top-down — more-specific rules go first.
 */
const RULES: Rule[] = [
  {
    keywords: ['stapler', 'office', 'meeting', 'desk', 'coffee'],
    category: 'ty_stapler',
  },
  {
    keywords: ['thank', 'thanks', ' ty ', 'appreciate', 'cheers'],
    category: 'ty',
  },
  {
    keywords: [
      'bye', 'goodbye', 'see ya', 'see you', 'leaving',
      'gtg', 'got to go', 'gotta go', 'later', 'peace out',
    ],
    category: 'bye',
  },
  {
    keywords: ['hungry', 'starving', 'lunch', 'dinner', 'eat'],
    category: 'idle_hungry',
  },
  {
    keywords: ['food', 'snack', 'larvae', 'larva', 'meal'],
    category: 'hungry_larvae',
  },
];

@Injectable()
export class ClipSelectorService {
  private readonly logger = new Logger(ClipSelectorService.name);

  /**
   * Returns the matched category, or null if no rule matched.
   * Caller decides what to do on null (typically: fall back to `idle/` or
   * fully random across all clips).
   */
  pickCategory(transcript: string): string | null {
    if (!transcript) return null;
    const haystack = ' ' + transcript.toLowerCase() + ' ';
    for (const rule of RULES) {
      for (const kw of rule.keywords) {
        if (haystack.includes(kw)) {
          this.logger.log(`matched "${kw}" -> ${rule.category}`);
          return rule.category;
        }
      }
    }
    return null;
  }
}
