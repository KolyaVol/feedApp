import { useState, useCallback } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as MailComposer from "expo-mail-composer";
import { getExportPayload, exportToJson, importFromJson, type ImportResult } from "../data/backup";
import { getBackupEmailSettings } from "../data/backupEmailSettings";
import { useLocale } from "../contexts/LocaleContext";

export function useBackup(refreshAll: () => void) {
  const { t } = useLocale();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sendingToEmail, setSendingToEmail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const clearMessage = useCallback(() => {
    setMessage(null);
    setIsSuccess(false);
  }, []);

  const exportData = useCallback(async () => {
    setExporting(true);
    setMessage(null);
    setIsSuccess(false);
    try {
      const payload = await getExportPayload();
      const json = exportToJson(payload);
      const name = `feed-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File(Paths.cache, name);
      file.write(json);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/json",
          dialogTitle: t("backupExportDialogTitle"),
        });
      } else {
        setIsSuccess(false);
        setMessage(t("backupSharingUnavailable"));
      }
    } catch (e) {
      setIsSuccess(false);
      setMessage(t("backupExportFailed"));
    } finally {
      setExporting(false);
    }
  }, [t]);

  const importData = useCallback(async () => {
    setImporting(true);
    setMessage(null);
    setIsSuccess(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        setImporting(false);
        return;
      }
      const pickedFile = new File(result.assets[0]);
      const json = pickedFile.textSync();
      const importResult: ImportResult = await importFromJson(json);
      if (importResult.ok) {
        refreshAll();
        setIsSuccess(true);
        setMessage(t("backupDataRestored"));
      } else {
        setIsSuccess(false);
        setMessage(t(importResult.error));
      }
    } catch (e) {
      setIsSuccess(false);
      setMessage(t("backupImportFailed"));
    } finally {
      setImporting(false);
    }
  }, [refreshAll, t]);

  const sendToEmail = useCallback(async () => {
    setSendingToEmail(true);
    setMessage(null);
    setIsSuccess(false);
    try {
      const { email, subject } = await getBackupEmailSettings();
      const trimmed = email.trim();
      if (!trimmed) {
        setIsSuccess(false);
        setMessage(t("backupEmailNotConfigured"));
        setSendingToEmail(false);
        return;
      }
      const payload = await getExportPayload();
      const json = exportToJson(payload);
      const name = `feed-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File(Paths.cache, name);
      file.write(json);
      const available = await MailComposer.isAvailableAsync();
      if (!available) {
        setIsSuccess(false);
        setMessage(t("backupMailUnavailable"));
        setSendingToEmail(false);
        return;
      }
      const subjectLine =
        subject?.trim() || `Feed backup ${new Date().toISOString().slice(0, 10)}`;
      const result = await MailComposer.composeAsync({
        recipients: [trimmed],
        subject: subjectLine,
        body: "Feed backup attachment.",
        attachments: [file.uri],
      });
      if (result.status === "sent") {
        setIsSuccess(true);
        setMessage(t("backupMailSent"));
      } else if (result.status === "cancelled") {
        setMessage(t("backupMailCancelled"));
      }
    } catch (e) {
      setIsSuccess(false);
      setMessage(e instanceof Error ? e.message : t("backupExportFailed"));
    } finally {
      setSendingToEmail(false);
    }
  }, [t]);

  return {
    exportData,
    importData,
    sendToEmail,
    exporting,
    importing,
    sendingToEmail,
    message,
    isSuccess,
    clearMessage,
  };
}
