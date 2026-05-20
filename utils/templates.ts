import type { TemplateDefinition } from '@/types';

const ROSE    = '#DD8C84';
const AMBER   = '#E0B265';
const EMERALD = '#2DA37F';
const SKY     = '#5FA3CC';
const VIOLET  = '#8270C8';

export const BOARD_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'mad-sad-glad',
    name: 'Mad / Sad / Glad',
    description: 'Classic emotional check-in format for team retrospectives',
    columns: [
      { title: 'Mad',  color: ROSE,    description: 'What frustrated you?' },
      { title: 'Sad',  color: SKY,     description: 'What disappointed you?' },
      { title: 'Glad', color: EMERALD, description: 'What made you happy?' },
    ],
  },
  {
    id: 'liked-learned-lacked',
    name: 'Liked / Learned / Lacked',
    description: 'Reflect on positives, growth, and gaps',
    columns: [
      { title: 'Liked',   color: EMERALD, description: 'What did you enjoy?' },
      { title: 'Learned', color: SKY,     description: 'What did you learn?' },
      { title: 'Lacked',  color: AMBER,   description: 'What was missing?' },
    ],
  },
  {
    id: 'start-stop-continue',
    name: 'Start / Stop / Continue',
    description: 'Action-oriented format for process improvement',
    columns: [
      { title: 'Start',    color: EMERALD, description: 'What should we begin doing?' },
      { title: 'Stop',     color: ROSE,    description: 'What should we stop doing?' },
      { title: 'Continue', color: SKY,     description: 'What should we keep doing?' },
    ],
  },
  {
    id: 'went-well-didnt-action',
    name: "Went Well / Didn't Go Well / Action Items",
    description: 'Simple review with built-in action planning',
    columns: [
      { title: 'What Went Well',      color: EMERALD, description: 'Celebrate successes' },
      { title: "What Didn't Go Well", color: ROSE,    description: 'Identify challenges' },
      { title: 'Action Items',        color: VIOLET,  description: 'Plan improvements' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Board',
    description: 'Start with three columns you can rename and customize',
    columns: [
      { title: 'Column 1', color: SKY },
      { title: 'Column 2', color: EMERALD },
      { title: 'Column 3', color: ROSE },
    ],
  },
];
