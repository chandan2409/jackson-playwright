import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = (key: string, fallback = ''): string =>
  process.env[key] || fallback;

export const ENV = {
  FIRELIGHT_BASE_URL: required('FIRELIGHT_BASE_URL', 'https://flqanext.insurancetechnologies.com/EGApp/'),
  FIRELIGHT_USERNAME: required('FIRELIGHT_USERNAME'),
  FIRELIGHT_PASSWORD: required('FIRELIGHT_PASSWORD'),
  FIRELIGHT_JURISDICTION: required('FIRELIGHT_JURISDICTION', 'Colorado'),
  FIRELIGHT_PRODUCT: required('FIRELIGHT_PRODUCT', 'Elite Access II'),
  FIRELIGHT_CASE_NAME: required('FIRELIGHT_CASE_NAME', 'Boun'),
  CHANGE_TICKETS_PATH: required('CHANGE_TICKETS_PATH', 'tests/data/change-tickets.json'),
};

export default ENV;
