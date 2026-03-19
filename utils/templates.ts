import type { TemplateDefinition } from '@/types';

export const BOARD_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'mad-sad-glad',
    name: 'Mad / Sad / Glad',
    description: 'Classic emotional check-in format for team retrospectives',
    columns: [
      { title: 'Mad', color: '#B8072F', description: 'What frustrated you?' },
      { title: 'Sad', color: '#004F71', description: 'What disappointed you?' },
      { title: 'Glad', color: '#077E4C', description: 'What made you happy?' },
    ],
  },
  {
    id: 'liked-learned-lacked',
    name: 'Liked / Learned / Lacked',
    description: 'Reflect on positives, growth, and gaps',
    columns: [
      { title: 'Liked', color: '#249E6B', description: 'What did you enjoy?' },
      { title: 'Learned', color: '#3EB1C8', description: 'What did you learn?' },
      { title: 'Lacked', color: '#E33205', description: 'What was missing?' },
    ],
  },
  {
    id: 'start-stop-continue',
    name: 'Start / Stop / Continue',
    description: 'Action-oriented format for process improvement',
    columns: [
      { title: 'Start', color: '#077E4C', description: 'What should we begin doing?' },
      { title: 'Stop', color: '#B8072F', description: 'What should we stop doing?' },
      { title: 'Continue', color: '#004F71', description: 'What should we keep doing?' },
    ],
  },
  {
    id: 'went-well-didnt-action',
    name: 'Went Well / Didn\'t Go Well / Action Items',
    description: 'Simple review with built-in action planning',
    columns: [
      { title: 'What Went Well', color: '#249E6B', description: 'Celebrate successes' },
      { title: 'What Didn\'t Go Well', color: '#E33205', description: 'Identify challenges' },
      { title: 'Action Items', color: '#004F71', description: 'Plan improvements' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Board',
    description: 'Start with three columns you can rename and customize',
    columns: [
      { title: 'Column 1', color: '#004F71' },
      { title: 'Column 2', color: '#249E6B' },
      { title: 'Column 3', color: '#E33205' },
    ],
  },
];
