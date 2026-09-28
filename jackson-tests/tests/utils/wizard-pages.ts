/** Firelight Elite Access II wizard pages — baseline capture and detect must visit all of these. */
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
