import AsyncStorage from "@react-native-async-storage/async-storage";
import { KEYS } from "./storageKeys";

export interface BackupEmailSettings {
  email: string;
  subject?: string;
}

export async function getBackupEmailSettings(): Promise<BackupEmailSettings> {
  const [email, subject] = await Promise.all([
    AsyncStorage.getItem(KEYS.BACKUP_EMAIL),
    AsyncStorage.getItem(KEYS.BACKUP_EMAIL_SUBJECT),
  ]);
  return {
    email: email ?? "",
    subject: subject ?? undefined,
  };
}

export async function setBackupEmailSettings(settings: BackupEmailSettings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.BACKUP_EMAIL, settings.email),
    settings.subject
      ? AsyncStorage.setItem(KEYS.BACKUP_EMAIL_SUBJECT, settings.subject)
      : AsyncStorage.removeItem(KEYS.BACKUP_EMAIL_SUBJECT),
  ]);
}
