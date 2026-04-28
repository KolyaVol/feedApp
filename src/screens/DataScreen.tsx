import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { useFeedDays } from "../hooks/useFeedDays";
import { useFeedDaysContext } from "../contexts/FeedDaysContext";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import type { FeedDay, MealEntry, MealType } from "../types";
import { addDaysToDate, formatDateStr } from "../data/feedDays";
import { formatDaysForChat } from "../utils/exportText";
import {
  collectRecentGrams,
  collectRecentProducts,
  getGramSuggestions as computeGramSuggestions,
  rankProductSuggestions,
} from "../utils/mealSuggestions";
import {
  removeMealEntryAt,
  setMealEntryField,
} from "../utils/mealMutations";
import { mealLabel as getMealLabel } from "../utils/mealLabels";
import { ScreenTitle } from "../components/ScreenTitle";
import { CenteredLoader } from "../components/CenteredLoader";
import { useToast } from "../hooks/useToast";
import { DayRow } from "./data/DayRow";
import { RowActionsModal } from "./data/RowActionsModal";
import { AddProductModal } from "./data/AddProductModal";
import { ShiftStartDateModal } from "./data/ShiftStartDateModal";
import { isValidIsoDate, useDateDrafts } from "./data/hooks";
import { useDataScreenStyles } from "./data/styles";

export function DataScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const g = useGlobalStyles();
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const s = useDataScreenStyles(colors, width);
  const { days, loading, refresh, addDay, insertDayAt, updateDay, deleteDay, moveDay, replaceAll } =
    useFeedDays();
  const { syncing, lastError, pullNow, clearError } = useFeedDaysContext();

  const { toast, show: showToastRaw } = useToast<{ kind: "success" | "error"; text: string }>(2500);
  const [pulling, setPulling] = useState(false);
  const [actionModalDayId, setActionModalDayId] = useState<string | null>(null);
  const [addProductModal, setAddProductModal] = useState<{
    dayId: string;
    mealType: MealType;
  } | null>(null);
  const [newProduct, setNewProduct] = useState("");
  const [newGrams, setNewGrams] = useState("");
  const [startDateModalVisible, setStartDateModalVisible] = useState(false);
  const [newStartDate, setNewStartDate] = useState("");
  const [activeProductField, setActiveProductField] = useState<string | null>(null);
  const [activeGramsField, setActiveGramsField] = useState<string | null>(null);
  const dateDrafts = useDateDrafts();
  const oldestDay = days.length > 0 ? days[days.length - 1] : null;

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const showToast = useCallback((kind: "success" | "error", text: string) => {
    showToastRaw({ kind, text });
  }, [showToastRaw]);

  useEffect(() => {
    if (!lastError) return;
    showToast("error", lastError.text);
    clearError();
  }, [lastError, showToast, clearError]);

  const handleAddDay = useCallback(async () => {
    await addDay();
  }, [addDay]);

  const handlePull = useCallback(async () => {
    setPulling(true);
    const result = await pullNow();
    setPulling(false);
    if (result.ok && result.days) {
      showToast("success", `${t("dataPullSuccess")} (${result.days.length})`);
    } else if (!result.ok) {
      showToast("error", result.text);
    }
  }, [pullNow, showToast, t]);

  const handleCopyForChat = useCallback(async () => {
    if (days.length === 0) return;
    try {
      const text = formatDaysForChat(days);
      await Clipboard.setStringAsync(text);
      showToast("success", t("dataCopied"));
    } catch (e: any) {
      showToast("error", e?.message ?? "Copy failed");
    }
  }, [days, showToast, t]);

  const handleDeleteDay = useCallback(
    (id: string) => {
      if (Platform.OS === "web") {
        const ok = typeof globalThis.confirm === "function"
          ? globalThis.confirm(t("dataConfirmDelete"))
          : true;
        if (ok) {
          void deleteDay(id);
          setActionModalDayId(null);
        }
        return;
      }
      Alert.alert(t("dataConfirmDelete"), "", [
        { text: t("dataNo"), style: "cancel" },
        {
          text: t("dataYes"),
          style: "destructive",
          onPress: () => {
            deleteDay(id);
            setActionModalDayId(null);
          },
        },
      ]);
    },
    [deleteDay, t],
  );

  const handleOpenStartDateModal = useCallback(() => {
    setNewStartDate(oldestDay?.date ?? formatDateStr(new Date()));
    setStartDateModalVisible(true);
  }, [oldestDay]);

  const handleApplyStartDate = useCallback(async () => {
    if (days.length === 0) return;
    const raw = newStartDate.trim();
    if (!isValidIsoDate(raw)) {
      showToast("error", t("dataInvalidDate"));
      return;
    }
    const targetDate = new Date(raw + "T00:00:00");
    if (!oldestDay) return;
    const currentStart = new Date(oldestDay.date + "T00:00:00");
    if (isNaN(currentStart.getTime())) return;
    const deltaDays = Math.round(
      (targetDate.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000),
    );
    const shiftedDays = days.map((day) => ({
      ...day,
      date: addDaysToDate(day.date, deltaDays),
    }));
    await replaceAll(shiftedDays);
    setStartDateModalVisible(false);
    showToast("success", t("settingsSaved"));
  }, [days, newStartDate, oldestDay, replaceAll, showToast, t]);

  const handleDateBlur = useCallback(
    (day: FeedDay) => {
      dateDrafts.blur(
        day,
        (dayId, date) => updateDay(dayId, { date }),
        () => showToast("error", t("dataInvalidDate")),
      );
    },
    [dateDrafts, showToast, t, updateDay],
  );

  const handleMoveUp = useCallback(
    (id: string) => {
      const idx = days.findIndex((d) => d.id === id);
      if (idx > 0) moveDay(idx, idx - 1);
      setActionModalDayId(null);
    },
    [days, moveDay],
  );

  const handleMoveDown = useCallback(
    (id: string) => {
      const idx = days.findIndex((d) => d.id === id);
      if (idx < days.length - 1) moveDay(idx, idx + 1);
      setActionModalDayId(null);
    },
    [days, moveDay],
  );

  const handleInsertAbove = useCallback(
    (id: string) => {
      const idx = days.findIndex((d) => d.id === id);
      if (idx < 0) return;
      void insertDayAt(idx);
      setActionModalDayId(null);
    },
    [days, insertDayAt],
  );

  const handleInsertBelow = useCallback(
    (id: string) => {
      const idx = days.findIndex((d) => d.id === id);
      if (idx < 0) return;
      void insertDayAt(idx + 1);
      setActionModalDayId(null);
    },
    [days, insertDayAt],
  );

  const updateMealEntry = useCallback(
    (dayId: string, mealType: MealType, entryIdx: number, field: "product" | "grams", value: string) => {
      const day = days.find((d) => d.id === dayId);
      if (!day) return;
      const patch = setMealEntryField(day, mealType, entryIdx, field, value);
      if (patch) updateDay(dayId, patch);
    },
    [days, updateDay],
  );

  const removeMealEntry = useCallback(
    (dayId: string, mealType: MealType, entryIdx: number) => {
      const day = days.find((d) => d.id === dayId);
      if (!day) return;
      updateDay(dayId, removeMealEntryAt(day, mealType, entryIdx));
    },
    [days, updateDay],
  );

  const openAddProduct = useCallback((dayId: string, mealType: MealType) => {
    setNewProduct("");
    setNewGrams("");
    setAddProductModal({ dayId, mealType });
  }, []);

  const confirmAddProduct = useCallback(() => {
    if (!addProductModal) return;
    const product = newProduct.trim();
    if (!product) return;
    const grams = parseInt(newGrams, 10);
    const day = days.find((d) => d.id === addProductModal.dayId);
    if (!day) return;
    const entry: MealEntry = { product, grams: isNaN(grams) ? 0 : grams };
    const updated = [...day[addProductModal.mealType], entry];
    updateDay(addProductModal.dayId, { [addProductModal.mealType]: updated });
    setAddProductModal(null);
  }, [addProductModal, days, newGrams, newProduct, updateDay]);

  const actionDay = useMemo(
    () => (actionModalDayId ? days.find((d) => d.id === actionModalDayId) ?? null : null),
    [actionModalDayId, days],
  );
  const recentProducts = useMemo(() => collectRecentProducts(days), [days]);
  const recentGrams = useMemo(() => collectRecentGrams(days), [days]);
  const getProductSuggestions = useCallback(
    (value: string) =>
      rankProductSuggestions(value, recentProducts, "emptyReturnsAll"),
    [recentProducts],
  );
  const getGramSuggestions = useCallback(
    (raw: string, fallback: number) =>
      computeGramSuggestions(raw, fallback, recentGrams),
    [recentGrams],
  );
  const modalProductSuggestions = useMemo(
    () => getProductSuggestions(newProduct),
    [getProductSuggestions, newProduct],
  );
  const modalGramSuggestions = useMemo(
    () => getGramSuggestions(newGrams, recentGrams[0] ?? 0),
    [getGramSuggestions, newGrams, recentGrams],
  );

  const todayStr = formatDateStr(new Date());
  const mealLabel = useCallback((type: MealType) => getMealLabel(t, type), [t]);

  if (loading) {
    return <CenteredLoader />;
  }

  return (
    <View style={g.screenContainer}>
      <ScrollView
        contentContainerStyle={[g.screenContent, { paddingBottom: 100 + insets.bottom }]}
      >
        <ScreenTitle>{t("titleData")}</ScreenTitle>

        <View style={s.toolbar}>
          <TouchableOpacity style={[s.toolBtn, { backgroundColor: colors.primary }]} onPress={handleAddDay}>
            <Text style={s.toolBtnTextWhite}>+ {t("dataAddRow")}</Text>
          </TouchableOpacity>
          {locale === "en" && (
            <TouchableOpacity
              style={[s.toolBtn, { backgroundColor: colors.chipBg }]}
              onPress={handlePull}
              disabled={syncing || pulling}
            >
              <Text style={[s.toolBtnText, { color: colors.text }]}>
                {pulling ? t("dataPulling") : t("dataPull")}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.toolBtn, { backgroundColor: colors.chipBg }]}
            onPress={handleOpenStartDateModal}
          >
            <Text style={[s.toolBtnText, { color: colors.text }]}>{t("dataChangeStartDate")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.toolBtn,
              { backgroundColor: colors.chipBg },
              days.length === 0 && g.buttonDisabled,
            ]}
            onPress={handleCopyForChat}
            disabled={days.length === 0}
          >
            <Text style={[s.toolBtnText, { color: colors.text }]}>{t("dataCopyForChat")}</Text>
          </TouchableOpacity>
        </View>

        {days.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={[s.emptyIcon]}>📋</Text>
            <Text style={g.emptyText}>{t("dataNoRows")}</Text>
            <Text style={[g.labelMuted, { textAlign: "center", marginTop: 6 }]}>
              {t("dataNoRowsHint")}
            </Text>
          </View>
        ) : (
          <View style={s.cardsWrap}>
            {days.map((day) => (
              <DayRow
                key={day.id}
                day={day}
                isToday={day.date === todayStr}
                styles={s}
                colors={colors}
                t={t}
                dateDraft={dateDrafts.drafts[day.id]}
                onDateFocus={dateDrafts.focus}
                onDateChange={dateDrafts.change}
                onDateBlur={handleDateBlur}
                onOpenActions={setActionModalDayId}
                onUpdateNotes={(id, notes) => updateDay(id, { notes })}
                onOpenAddProduct={openAddProduct}
                onUpdateMealEntry={updateMealEntry}
                onRemoveMealEntry={removeMealEntry}
                onFocusProductField={setActiveProductField}
                onFocusGramsField={setActiveGramsField}
                activeProductField={activeProductField}
                activeGramsField={activeGramsField}
                productSuggestions={getProductSuggestions}
                gramSuggestions={getGramSuggestions}
                recentTopGrams={recentGrams[0] ?? 0}
                mealLabel={mealLabel}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <RowActionsModal
        dayId={actionModalDayId}
        day={actionDay}
        styles={s}
        globalStyles={g}
        colors={colors}
        locale={locale}
        t={t}
        onClose={() => setActionModalDayId(null)}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onInsertAbove={handleInsertAbove}
        onInsertBelow={handleInsertBelow}
        onAddMeal={(day, mealType) => {
          openAddProduct(day.id, mealType);
          setActionModalDayId(null);
        }}
        onDelete={handleDeleteDay}
      />

      <AddProductModal
        visible={!!addProductModal}
        mealType={addProductModal?.mealType ?? null}
        styles={s}
        globalStyles={g}
        colors={colors}
        t={t}
        mealLabel={mealLabel}
        product={newProduct}
        grams={newGrams}
        onProductChange={setNewProduct}
        onGramsChange={setNewGrams}
        onFocusProductField={() => setActiveProductField("modal")}
        onFocusGramsField={() => setActiveGramsField("modal")}
        productSuggestions={modalProductSuggestions}
        gramSuggestions={modalGramSuggestions}
        onClose={() => setAddProductModal(null)}
        onConfirm={confirmAddProduct}
      />

      <ShiftStartDateModal
        visible={startDateModalVisible}
        value={newStartDate}
        globalStyles={g}
        colors={colors}
        t={t}
        onChange={setNewStartDate}
        onClose={() => setStartDateModalVisible(false)}
        onApply={handleApplyStartDate}
      />

      <Modal visible={!!toast} animationType="none" transparent statusBarTranslucent>
        <View style={s.toastLayer} pointerEvents="none">
          {toast && (
            <View
              style={[
                s.toast,
                { top: insets.top + 8 },
                toast.value.kind === "success"
                  ? { backgroundColor: colors.pastelGreen, borderColor: colors.primary }
                  : { backgroundColor: colors.pastelRed, borderColor: colors.danger },
              ]}
            >
              <Text style={[s.toastText, { color: colors.text }]}>{toast.value.text}</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
