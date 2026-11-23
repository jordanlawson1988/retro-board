/** Features gated by a row in feature_flags. Declared once; add new keys here. */
export const FEATURES = ['guided_mode', 'summary_email'] as const;
export type Feature = (typeof FEATURES)[number];

export const GUIDED_MODE_FEATURE = FEATURES[0];
export const SUMMARY_EMAIL_FEATURE = FEATURES[1];
