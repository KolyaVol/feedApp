import { useState, useCallback } from "react";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { getExportPayload, exportToJson, importFromJson, type ImportResult } from "../data/backup";

export function useBackup(refreshAll: () => void) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const clearMessage = useCallback(() => setMessage(null), []);

  const exportData = useCallback(async () => {
    setExporting(true);
    setMessage(null);
    try {
      const payload = await getExportPayload();
      const json = exportToJson(payload);
      const name = `feed-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const path = `${FileSystem.cacheDirectory}${name}`;
      await FileSystem.writeAsStringAsync(path, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, {
          mimeType: "application/json",
          dialogTitle: "Export feed data",
        });
      } else {
        setMessage("Sharing is not available on this device");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, []);

  const importData = useCallback(async () => {
    setImporting(true);
    setMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        setImporting(false);
        return;
      }
      const uri = result.assets[0].uri;
      const json = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const importResult: ImportResult = await importFromJson(json);
      if (importResult.ok) {
        refreshAll();
        setMessage("Data restored successfully");
      } else {
        setMessage(importResult.error);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [refreshAll]);

  return {
    exportData,
    importData,
    exporting,
    importing,
    message,
    clearMessage,
  };
}
