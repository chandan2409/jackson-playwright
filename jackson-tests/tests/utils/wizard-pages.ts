/** Firelight Elite Access II wizard pages — baseline capture and detect must visit all of these. */
export const FILLED_SUFFIX = '__filled';

export function filledPageKey(pageKey: string): string {
  return pageKey.endsWith(FILLED_SUFFIX) ? pageKey : `${pageKey}${FILLED_SUFFIX}`;
}

export function isFilledPageKey(pageKey: string): boolean {
  return pageKey.endsWith(FILLED_SUFFIX);
}

export function landingPageKey(pageKey: string): string {
  return pageKey.endsWith(FILLED_SUFFIX) ? pageKey.slice(0, -FILLED_SUFFIX.length) : pageKey;
}

export const WIZARD_PAGES = [
  'select-application',
  'new-application-information',
  'owner',
  'beneficiaries',
  'agent',
  'systematic-investment',
  'initial-allocations',
  'add-on-benefits',
  'payment-detail',
  'signing-process',
] as const;

export type WizardPageKey = (typeof WIZARD_PAGES)[number];
