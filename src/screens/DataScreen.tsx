import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  useWindowDimensions,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { spacing } from "../theme";

export function DataScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const g = useGlobalStyles();
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const s = useDataScreenStyles(colors, width);
  const { days, loading, addDay, insertDayAt, updateDay, deleteDay, moveDay, replaceAll } =
    useFeedDays();
  const { syncing, lastError, pullNow, clearError } = useFeedDaysContext();

  const daysRef = useRef(days);
  daysRef.current = days;

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
  const dateDrafts = useDateDrafts();
  const oldestDay = days.length > 0 ? days[days.length - 1] : null;

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
    if (daysRef.current.length === 0) return;
    try {
      const text = formatDaysForChat(daysRef.current);
      await Clipboard.setStringAsync(text);
      showToast("success", t("dataCopied"));
    } catch (e: any) {
      showToast("error", e?.message ?? "Copy failed");
    }
  }, [showToast, t]);

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
    const currentDays = daysRef.current;
    if (currentDays.length === 0) return;
    const raw = newStartDate.trim();
    if (!isValidIsoDate(raw)) {
      showToast("error", t("dataInvalidDate"));
      return;
    }
    const targetDate = new Date(raw + "T00:00:00");
    const oldest = currentDays[currentDays.length - 1];
    if (!oldest) return;
    const currentStart = new Date(oldest.date + "T00:00:00");
    if (isNaN(currentStart.getTime())) return;
    const deltaDays = Math.round(
      (targetDate.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000),
    );
    const shiftedDays = currentDays.map((day) => ({
      ...day,
      date: addDaysToDate(day.date, deltaDays),
    }));
    await replaceAll(shiftedDays);
    setStartDateModalVisible(false);
    showToast("success", t("settingsSaved"));
  }, [newStartDate, replaceAll, showToast, t]);

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
      const list = daysRef.current;
      const idx = list.findIndex((d) => d.id === id);
      if (idx > 0) moveDay(idx, idx - 1);
      setActionModalDayId(null);
    },
    [moveDay],
  );

  const handleMoveDown = useCallback(
    (id: string) => {
      const list = daysRef.current;
      const idx = list.findIndex((d) => d.id === id);
      if (idx < list.length - 1) moveDay(idx, idx + 1);
      setActionModalDayId(null);
    },
    [moveDay],
  );

  const handleInsertAbove = useCallback(
    (id: string) => {
      const idx = daysRef.current.findIndex((d) => d.id === id);
      if (idx < 0) return;
      void insertDayAt(idx);
      setActionModalDayId(null);
    },
    [insertDayAt],
  );

  const handleInsertBelow = useCallback(
    (id: string) => {
      const idx = daysRef.current.findIndex((d) => d.id === id);
      if (idx < 0) return;
      void insertDayAt(idx + 1);
      setActionModalDayId(null);
    },
    [insertDayAt],
  );

  const commitMealEntry = useCallback(
    (dayId: string, mealType: MealType, entryIdx: number, field: "product" | "grams", value: string) => {
      const day = daysRef.current.find((d) => d.id === dayId);
      if (!day) return;
      const patch = setMealEntryField(day, mealType, entryIdx, field, value);
      if (patch) updateDay(dayId, patch);
    },
    [updateDay],
  );

  const commitNotes = useCallback(
    (dayId: string, notes: string) => {
      updateDay(dayId, { notes });
    },
    [updateDay],
  );

  const removeMealEntry = useCallback(
    (dayId: string, mealType: MealType, entryIdx: number) => {
      const day = daysRef.current.find((d) => d.id === dayId);
      if (!day) return;
      updateDay(dayId, removeMealEntryAt(day, mealType, entryIdx));
    },
    [updateDay],
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
    const day = daysRef.current.find((d) => d.id === addProductModal.dayId);
    if (!day) return;
    const entry: MealEntry = { product, grams: isNaN(grams) ? 0 : grams };
    const updated = [...day[addProductModal.mealType], entry];
    updateDay(addProductModal.dayId, { [addProductModal.mealType]: updated });
    setAddProductModal(null);
  }, [addProductModal, newGrams, newProduct, updateDay]);

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

  const onOpenActions = useCallback((dayId: string) => {
    setActionModalDayId(dayId);
  }, []);

  const listContentPadding = useMemo(
    () => [g.screenContent, { paddingBottom: 100 + insets.bottom }],
    [g.screenContent, insets.bottom],
  );

  const listHeader = useMemo(
    () => (
      <>
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
      </>
    ),
    [
      t,
      s,
      colors,
      handleAddDay,
      locale,
      handlePull,
      syncing,
      pulling,
      handleOpenStartDateModal,
      days.length,
      g.buttonDisabled,
      handleCopyForChat,
    ],
  );

  const listEmpty = useMemo(
    () => (
      <View style={s.emptyWrap}>
        <Text style={[s.emptyIcon]}>📋</Text>
        <Text style={g.emptyText}>{t("dataNoRows")}</Text>
        <Text style={[g.labelMuted, { textAlign: "center", marginTop: 6 }]}>
          {t("dataNoRowsHint")}
        </Text>
      </View>
    ),
    [s, g, t],
  );

  const renderDay: ListRenderItem<FeedDay> = useCallback(
    ({ item }) => (
      <View style={{ paddingHorizontal: spacing.screenPadding }}>
      <DayRow
        day={item}
        isToday={item.date === todayStr}
        styles={s}
        colors={colors}
        t={t}
        dateDraft={dateDrafts.drafts[item.id]}
        onDateFocus={dateDrafts.focus}
        onDateChange={dateDrafts.change}
        onDateBlur={handleDateBlur}
        onOpenActions={onOpenActions}
        onCommitNotes={commitNotes}
        onOpenAddProduct={openAddProduct}
        onCommitMealEntry={commitMealEntry}
        onRemoveMealEntry={removeMealEntry}
        recentProducts={recentProducts}
        recentGrams={recentGrams}
        mealLabel={mealLabel}
      />
      </View>
    ),
    [
      todayStr,
      s,
      colors,
      t,
      dateDrafts.drafts,
      dateDrafts.focus,
      dateDrafts.change,
      handleDateBlur,
      onOpenActions,
      commitNotes,
      openAddProduct,
      commitMealEntry,
      removeMealEntry,
      recentProducts,
      recentGrams,
      mealLabel,
    ],
  );

  const keyExtractor = useCallback((item: FeedDay) => item.id, []);

  if (loading) {
    return <CenteredLoader />;
  }

  return (
    <View style={g.screenContainer}>
      <FlatList
        data={days}
        keyExtractor={keyExtractor}
        renderItem={renderDay}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={listContentPadding}
        extraData={dateDrafts.drafts}
        keyboardShouldPersistTaps="handled"
        windowSize={7}
        maxToRenderPerBatch={8}
        initialNumToRender={6}
        removeClippedSubviews={Platform.OS === "android"}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

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
        onFocusProductField={() => {}}
        onFocusGramsField={() => {}}
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
