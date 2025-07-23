import { getRequiredEnv } from './env-helper';

export const PASSWORD = getRequiredEnv("PASSWORD");

export enum UserStates {
  AWAITING_IMPORT = 'awaiting_import'
}
