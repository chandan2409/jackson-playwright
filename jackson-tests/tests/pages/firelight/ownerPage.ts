import { Page } from '@playwright/test';
import { selectByLabel, fillByLabel, clickNext } from '../../utils/form-helpers';

export type OwnerData = {
  firstName: string;
  middleName: string;
  lastName: string;
  ssn: string;
  dateOfBirth: string;
  sex: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  mailingDifferent: string;
  phoneTransferConsent: string;
  eDeliveryConsent: string;
  email: string;
  authorizeOther: string;
  backupWithholding: string;
  activeMilitary: string;
  citizenship: string;
};

export class OwnerPage {
  constructor(private page: Page) {}

  async fill(data: OwnerData) {
    await fillByLabel(this.page, 'First Name', data.firstName);
    await fillByLabel(this.page, 'Middle Name', data.middleName);
    await fillByLabel(this.page, 'Last Name', data.lastName);
    await fillByLabel(this.page, 'SSN', data.ssn);
    await fillByLabel(this.page, 'Date of Birth', data.dateOfBirth);
    await selectByLabel(this.page, 'Sex', data.sex);
    await fillByLabel(this.page, 'Physical Address Line 1', data.address1);
    await fillByLabel(this.page, 'Physical Address Line 2', data.address2);
    await fillByLabel(this.page, 'City', data.city);
    await selectByLabel(this.page, 'State', data.state);
    await fillByLabel(this.page, 'Zip code', data.zip);
    await fillByLabel(this.page, 'Phone', data.phone);
    await selectByLabel(
      this.page,
      'Is the mailing address different than the physical address?',
      data.mailingDifferent,
    );
    await selectByLabel(
      this.page,
      'Do you consent to Telephone/Electronic Transfer Authorization?',
      data.phoneTransferConsent,
    );
    await selectByLabel(
      this.page,
      'Do you consent to Electronic Delivery of Documents?',
      data.eDeliveryConsent,
    );
    await fillByLabel(this.page, 'Email Address', data.email);
    await selectByLabel(
      this.page,
      'Do you wish to authorize an individual other than your Financial Professional',
      data.authorizeOther,
    );
    await selectByLabel(
      this.page,
      'Has the IRS notified you that you are subject to backup withholding?',
      data.backupWithholding,
    );
    await selectByLabel(this.page, 'Are you an active military member?', data.activeMilitary);
    await selectByLabel(this.page, 'Citizenship', data.citizenship);
  }

  async next() {
    await clickNext(this.page);
  }
}
