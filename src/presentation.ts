import type { Skill } from '../spacetimedb/src/types';
export const SKILLS: Skill[] = ['authority', 'urgency', 'verification'];
export const LABELS: Record<Skill, string> = { authority: 'Question authority', urgency: 'Resist urgency', verification: 'Verify independently' };
