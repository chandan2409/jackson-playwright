/**
 * Elite Access II / Colorado / case Boun.
 * Excel rows spell actions and select values; name/SSN/address cells are
 * "enter the Data value" with no payload — sandbox PII lives here.
 */
export const happyPathData = {
  caseName: 'Boun',
  jurisdiction: 'Colorado',
  product: 'Elite Access II (B Share)',
  ownershipType: 'Individual',
  annuitantSameAsOwner: 'Yes',
  jointAnnuitant: 'No',
  taxQualificationType: 'Qualified Account',
  qualifiedAccountType: 'Roth IRA',
  owner: {
    firstName: 'Boun',
    middleName: 'T',
    lastName: 'Tester',
    ssn: '000000000',
    dateOfBirth: '01/01/1980',
    sex: 'Male',
    address1: '100 Main St',
    address2: 'Suite 1',
    city: 'Denver',
    state: 'CO',
    zip: '80202',
    phone: '3035550100',
    mailingDifferent: 'No',
    phoneTransferConsent: 'No',
    eDeliveryConsent: 'Yes',
    email: 'boun.tester@example.com',
    authorizeOther: 'No',
    backupWithholding: 'No',
    activeMilitary: 'No',
    citizenship: 'U.S. Citizen',
  },
  primaryBeneficiary: {
    type: 'Living Person',
    firstName: 'Pat',
    middleName: 'A',
    lastName: 'Beneficiary',
    ssn: '000000001',
    dateOfBirth: '02/02/1982',
    sex: 'Female',
    relationship: 'Wife',
    proceedsPct: '100',
  },
  contingentBeneficiary: {
    beneficiaryType: 'Contingent',
    type: 'Living Person',
    firstName: 'Sam',
    middleName: 'B',
    lastName: 'Beneficiary',
    ssn: '000000002',
    dateOfBirth: '03/03/2005',
    sex: 'Male',
    relationship: 'Son',
    proceedsPct: '100',
  },
  agent: {
    jacksonApprovedMaterials: 'Yes',
    firstName: 'Alex',
    middleName: 'C',
    lastName: 'Agent',
    ssn: '000000003',
    commissionPct: '100',
    email: 'alex.agent@example.com',
    commissionOption: 'A',
  },
  payment: {
    existingPolicies: 'No',
    replacing: 'No',
    premiumType: 'Tax Qualified - Rollover',
    paymentMethod: 'Financial Professional or Owner to Request Funds',
    amount: '50000',
  },
  signingMethod: 'Wet Signature',
};

/** Variant path: different owner email + contingent proceeds split for second script */
export const variantPathData = {
  ...happyPathData,
  caseName: 'Boun-Variant',
  owner: {
    ...happyPathData.owner,
    firstName: 'Boun',
    lastName: 'Variant',
    email: 'boun.variant@example.com',
  },
  primaryBeneficiary: {
    ...happyPathData.primaryBeneficiary,
    proceedsPct: '60',
  },
  contingentBeneficiary: {
    ...happyPathData.contingentBeneficiary,
    proceedsPct: '40',
  },
  payment: {
    ...happyPathData.payment,
    amount: '25000',
  },
};
