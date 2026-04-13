import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useFeedDays } from "../hooks/useFeedDays";
import { pullFeedDays, pushFeedDays } from "../remoteFeed/sync";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { fonts, spacing } from "../theme";
import type { FeedDay, MealEntry, MealType } from "../types";
import { addDaysToDate, formatDateStr } from "../data/feedDays";
import { getGithubToken } from "../data/settings";

const MEAL_TYPES: MealType[] = ["morning", "lunch", "evening"];

function formatDateShort(dateStr: string, locale?: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function isValidIsoDate(dateStr: string): boolean {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!match) return false;
  const d = new Date(dateStr + "T00:00:00");
  return !isNaN(d.getTime()) && formatDateStr(d) === dateStr;
}

export function DataScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const g = useGlobalStyles();
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const s = useStyles(colors, width);
  const { days, loading, refresh, addDay, updateDay, deleteDay, moveDay, replaceAll } =
    useFeedDays();

  const [syncing, setSyncing] = useState<"push" | "pull" | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [actionModalDayId, setActionModalDayId] = useState<string | null>(null);
  const [addProductModal, setAddProductModal] = useState<{
    dayId: string;
    mealType: MealType;
  } | null>(null);
  const [newProduct, setNewProduct] = useState("");
  const [newGrams, setNewGrams] = useState("");
  const [startDateModalVisible, setStartDateModalVisible] = useState(false);
  const [newStartDate, setNewStartDate] = useState("");
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});
  const [activeProductField, setActiveProductField] = useState<string | null>(null);
  const [activeGramsField, setActiveGramsField] = useState<string | null>(null);
  const mainScrollRef = useRef<ScrollView | null>(null);
  const autoPushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyForAutoPushRef = useRef(false);
  const initializedRef = useRef(false);
  const skipNextChangeRef = useRef(false);
  const lastPushedSnapshotRef = useRef("");
  const latestDaysRef = useRef(days);

  const snapshot = useMemo(() => JSON.stringify(days), [days]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const showToast = useCallback((kind: "success" | "error", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    latestDaysRef.current = days;
  }, [days]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastPushedSnapshotRef.current = snapshot;
      return;
    }
    if (skipNextChangeRef.current) {
      skipNextChangeRef.current = false;
      lastPushedSnapshotRef.current = snapshot;
      dirtyForAutoPushRef.current = false;
      return;
    }
    dirtyForAutoPushRef.current = snapshot !== lastPushedSnapshotRef.current;
  }, [snapshot]);

  useEffect(() => {
    if (!dirtyForAutoPushRef.current || syncing || loading) return;
    if (autoPushTimeoutRef.current) clearTimeout(autoPushTimeoutRef.current);
    autoPushTimeoutRef.current = setTimeout(async () => {
      if (syncing || !dirtyForAutoPushRef.current) return;
      const token = await getGithubToken();
      if (!token) return;
      setSyncing("push");
      const result = await pushFeedDays(latestDaysRef.current);
      if (result.ok) {
        lastPushedSnapshotRef.current = JSON.stringify(latestDaysRef.current);
        dirtyForAutoPushRef.current = false;
      } else {
        showToast("error", result.text);
      }
      setSyncing(null);
    }, 4000);

    return () => {
      if (autoPushTimeoutRef.current) clearTimeout(autoPushTimeoutRef.current);
    };
  }, [loading, showToast, syncing, snapshot]);

  const handleAddDay = useCallback(async () => {
    await addDay();
  }, [addDay]);

  const handlePull = useCallback(async () => {
    setSyncing("pull");
    const result = await pullFeedDays();
    if (result.ok && result.days) {
      if (result.days.length > 0) {
        const normalizedDays = result.days.map((day) => ({
          ...day,
          eaten: {},
        }));
        skipNextChangeRef.current = true;
        await replaceAll(normalizedDays);
        lastPushedSnapshotRef.current = JSON.stringify(normalizedDays);
        showToast("success", `${t("dataPullSuccess")} (${normalizedDays.length})`);
      } else {
        showToast("success", t("dataPullSuccess"));
      }
    } else {
      showToast("error", result.text);
    }
    setSyncing(null);
  }, [replaceAll, showToast, t]);

  const handleDeleteDay = useCallback(
    (id: string) => {
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
    setNewStartDate(days[0]?.date ?? formatDateStr(new Date()));
    setStartDateModalVisible(true);
  }, [days]);

  const handleApplyStartDate = useCallback(async () => {
    if (days.length === 0) return;
    const raw = newStartDate.trim();
    if (!isValidIsoDate(raw)) {
      showToast("error", t("dataInvalidDate"));
      return;
    }
    const targetDate = new Date(raw + "T00:00:00");
    const currentStart = new Date(days[0].date + "T00:00:00");
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
  }, [days, newStartDate, replaceAll, showToast, t]);

  const handleDateInputBlur = useCallback(
    (day: FeedDay) => {
      const raw = (dateDrafts[day.id] ?? day.date).trim();
      if (!raw) {
        setDateDrafts((prev) => {
          const next = { ...prev };
          delete next[day.id];
          return next;
        });
        return;
      }
      if (!isValidIsoDate(raw)) {
        showToast("error", t("dataInvalidDate"));
        setDateDrafts((prev) => {
          const next = { ...prev };
          delete next[day.id];
          return next;
        });
        return;
      }
      if (raw !== day.date) {
        updateDay(day.id, { date: raw });
      }
      setDateDrafts((prev) => {
        const next = { ...prev };
        delete next[day.id];
        return next;
      });
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

  const updateMealEntry = useCallback(
    (dayId: string, mealType: MealType, entryIdx: number, field: "product" | "grams", value: string) => {
      const day = days.find((d) => d.id === dayId);
      if (!day) return;
      const meals = [...day[mealType]];
      const entry = meals[entryIdx];
      if (!entry) return;
      if (field === "product") {
        meals[entryIdx] = { ...entry, product: value };
      } else {
        const n = parseInt(value, 10);
        meals[entryIdx] = { ...entry, grams: isNaN(n) ? 0 : n };
      }
      updateDay(dayId, { [mealType]: meals });
    },
    [days, updateDay],
  );

  const removeMealEntry = useCallback(
    (dayId: string, mealType: MealType, entryIdx: number) => {
      const day = days.find((d) => d.id === dayId);
      if (!day) return;
      const meals = day[mealType].filter((_, i) => i !== entryIdx);
      updateDay(dayId, { [mealType]: meals });
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
    () => (actionModalDayId ? days.find((d) => d.id === actionModalDayId) : null),
    [actionModalDayId, days],
  );
  const recentProducts = useMemo(() => {
    const unique = new Set<string>();
    const list: string[] = [];
    for (let d = days.length - 1; d >= 0; d -= 1) {
      const day = days[d];
      for (const mealType of MEAL_TYPES) {
        const entries = day[mealType];
        for (let i = entries.length - 1; i >= 0; i -= 1) {
          const product = entries[i]?.product?.trim();
          if (!product) continue;
          const key = product.toLocaleLowerCase();
          if (unique.has(key)) continue;
          unique.add(key);
          list.push(product);
        }
      }
    }
    return list;
  }, [days]);
  const recentGrams = useMemo(() => {
    const unique = new Set<number>();
    const list: number[] = [];
    for (let d = days.length - 1; d >= 0; d -= 1) {
      const day = days[d];
      for (const mealType of MEAL_TYPES) {
        const entries = day[mealType];
        for (let i = entries.length - 1; i >= 0; i -= 1) {
          const grams = entries[i]?.grams;
          if (typeof grams !== "number" || grams <= 0 || unique.has(grams)) continue;
          unique.add(grams);
          list.push(grams);
        }
      }
    }
    return list;
  }, [days]);
  const getProductSuggestions = useCallback(
    (value: string) => {
      const q = value.trim().toLocaleLowerCase();
      if (!q) return recentProducts.slice(0, 8);
      return recentProducts
        .filter((product) => product.toLocaleLowerCase().includes(q))
        .slice(0, 8);
    },
    [recentProducts],
  );
  const getGramSuggestions = useCallback(
    (raw: string, fallback: number) => {
      const parsed = parseInt(raw, 10);
      const base = !isNaN(parsed) && parsed > 0 ? parsed : fallback > 0 ? fallback : recentGrams[0] ?? 50;
      const around = [base + 10, base + 5, base - 5, base - 10].filter((v) => v > 0);
      const merged = [...around, ...recentGrams];
      return Array.from(new Set(merged)).slice(0, 6);
    },
    [recentGrams],
  );

  const todayStr = formatDateStr(new Date());

  const mealLabel = useCallback(
    (type: MealType) => {
      if (type === "morning") return t("mealMorning");
      if (type === "lunch") return t("mealLunch");
      return t("mealEvening");
    },
    [t],
  );

  if (loading) {
    return (
      <View style={[g.screenContainer, s.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={g.screenContainer}>
      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={[g.screenContent, { paddingBottom: 100 + insets.bottom }]}
      >
        <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
          {t("titleData")}
        </Text>

        <View style={s.toolbar}>
          <TouchableOpacity style={[s.toolBtn, { backgroundColor: colors.primary }]} onPress={handleAddDay}>
            <Text style={s.toolBtnTextWhite}>+ {t("dataAddRow")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toolBtn, { backgroundColor: colors.chipBg }]}
            onPress={handlePull}
            disabled={!!syncing}
          >
            <Text style={[s.toolBtnText, { color: colors.text }]}>
              {syncing === "pull" ? t("dataPulling") : t("dataPull")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toolBtn, { backgroundColor: colors.chipBg }]}
            onPress={handleOpenStartDateModal}
          >
            <Text style={[s.toolBtnText, { color: colors.text }]}>{t("dataChangeStartDate")}</Text>
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
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={s.tableWrap}>
              <View style={[s.headerRow, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                <View style={s.colDay}>
                  <Text style={[s.headerText, { color: colors.textMuted }]}>{t("dataDate")}</Text>
                </View>
                {MEAL_TYPES.map((type) => (
                  <React.Fragment key={type}>
                    <View style={s.colFood}>
                      <Text style={[s.headerText, { color: colors.textMuted }]}>{mealLabel(type)}</Text>
                    </View>
                    <View style={s.colGrams}>
                      <Text style={[s.headerText, { color: colors.textMuted }]}>{t("grams")}</Text>
                    </View>
                  </React.Fragment>
                ))}
                <View style={s.colNotes}>
                  <Text style={[s.headerText, { color: colors.textMuted }]}>{t("notes")}</Text>
                </View>
              </View>

              {days.map((day) => {
                const isToday = day.date === todayStr;
                return (
                  <View
                    key={day.id}
                    style={[
                      s.row,
                      { backgroundColor: colors.card, borderColor: colors.borderLight },
                      isToday && { backgroundColor: colors.chipSelectedBg },
                    ]}
                  >
                    <View style={s.colDay}>
                      <TextInput
                        style={[s.cellInput, s.cellDate, { color: colors.text, borderColor: colors.borderLight }]}
                        value={dateDrafts[day.id] ?? day.date}
                        onFocus={() =>
                          setDateDrafts((prev) => ({ ...prev, [day.id]: prev[day.id] ?? day.date }))
                        }
                        onChangeText={(v) =>
                          setDateDrafts((prev) => ({ ...prev, [day.id]: v.replace(/[^0-9-]/g, "") }))
                        }
                        onBlur={() => handleDateInputBlur(day)}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.placeholder}
                        maxLength={10}
                      />
                      <TouchableOpacity
                        style={[s.rowActionsBtn, { backgroundColor: colors.chipBg, borderColor: colors.borderLight }]}
                        onPress={() => setActionModalDayId(day.id)}
                      >
                        <Text style={[s.rowActionsIcon, { color: colors.text }]}>☰</Text>
                      </TouchableOpacity>
                    </View>
                    {MEAL_TYPES.map((type) => {
                      const meals = day[type];
                      return (
                        <React.Fragment key={type}>
                          <View style={s.colFood}>
                            {meals.length === 0 ? (
                              <TouchableOpacity
                                style={[s.addEntryBtn, { borderColor: colors.borderLight }]}
                                onPress={() => openAddProduct(day.id, type)}
                              >
                                <Text style={[s.addEntryText, { color: colors.primary }]}>+</Text>
                              </TouchableOpacity>
                            ) : (
                              meals.map((entry, idx) => (
                                <View key={idx} style={s.mealEntryRow}>
                                  <TextInput
                                    style={[s.cellInput, s.cellProduct, { color: colors.text, borderColor: colors.borderLight }]}
                                    value={entry.product}
                                    onChangeText={(v) => updateMealEntry(day.id, type, idx, "product", v)}
                                    onFocus={() => setActiveProductField(`${day.id}:${type}:${idx}`)}
                                    placeholder={t("product")}
                                    placeholderTextColor={colors.placeholder}
                                  />
                                  <TouchableOpacity
                                    style={s.removeEntryBtn}
                                    onPress={() => removeMealEntry(day.id, type, idx)}
                                  >
                                    <Text style={[s.removeEntryText, { color: colors.danger }]}>×</Text>
                                  </TouchableOpacity>
                                  {activeProductField === `${day.id}:${type}:${idx}` && (
                                    <View style={[s.suggestionsWrap, { borderColor: colors.borderLight, backgroundColor: colors.card }]}>
                                      {getProductSuggestions(entry.product).map((suggestion) => (
                                        <TouchableOpacity
                                          key={suggestion}
                                          style={[s.suggestionChip, { backgroundColor: colors.chipBg }]}
                                          onPress={() => updateMealEntry(day.id, type, idx, "product", suggestion)}
                                        >
                                          <Text style={[s.suggestionChipText, { color: colors.text }]}>{suggestion}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  )}
                                </View>
                              ))
                            )}
                            {meals.length > 0 && (
                              <TouchableOpacity
                                style={s.addMoreBtn}
                                onPress={() => openAddProduct(day.id, type)}
                              >
                                <Text style={[s.addMoreText, { color: colors.primary }]}>+ {t("add")}</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <View style={s.colGrams}>
                            {meals.map((entry, idx) => (
                              <TextInput
                                key={idx}
                                style={[
                                  s.cellInput,
                                  s.cellGrams,
                                  { color: colors.text, borderColor: colors.borderLight },
                                  (isNaN(entry.grams) || entry.grams < 0) && { borderColor: colors.danger },
                                ]}
                                value={entry.grams > 0 ? String(entry.grams) : ""}
                                onChangeText={(v) => updateMealEntry(day.id, type, idx, "grams", v)}
                                onFocus={() => setActiveGramsField(`${day.id}:${type}:${idx}`)}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={colors.placeholder}
                              />
                            ))}
                            {meals.map((entry, idx) => (
                              <View key={`${idx}-suggest`} style={s.inlineSuggestionsRow}>
                                {activeGramsField === `${day.id}:${type}:${idx}` &&
                                  getGramSuggestions(
                                    entry.grams > 0 ? String(entry.grams) : "",
                                    recentGrams[0] ?? 0,
                                  ).map((gram) => (
                                    <TouchableOpacity
                                      key={`${day.id}:${type}:${idx}:${gram}`}
                                      style={[s.gramChip, { backgroundColor: colors.chipBg }]}
                                      onPress={() => updateMealEntry(day.id, type, idx, "grams", String(gram))}
                                    >
                                      <Text style={[s.gramChipText, { color: colors.text }]}>{gram}</Text>
                                    </TouchableOpacity>
                                  ))}
                              </View>
                            ))}
                          </View>
                        </React.Fragment>
                      );
                    })}
                    <View style={s.colNotes}>
                      <TextInput
                        style={[s.cellInput, s.cellNotes, { color: colors.text, borderColor: colors.borderLight }]}
                        value={day.notes}
                        onChangeText={(v) => updateDay(day.id, { notes: v })}
                        placeholder={t("notes")}
                        placeholderTextColor={colors.placeholder}
                        multiline
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </ScrollView>

      {/* Row actions modal */}
      <Modal visible={!!actionModalDayId} animationType="fade" transparent>
        <Pressable style={g.modalOverlay} onPress={() => setActionModalDayId(null)}>
          <Pressable style={[g.modal, s.actionsModal]} onPress={(e) => e.stopPropagation()}>
            <Text style={g.modalTitle}>{t("dataRowActions")}</Text>
            {actionDay && (
              <Text style={[g.labelMuted, { marginBottom: 12 }]}>
                {formatDateShort(actionDay.date, locale)}
              </Text>
            )}
            <TouchableOpacity
              style={[s.actionModalBtn, { backgroundColor: colors.chipBg }]}
              onPress={() => actionModalDayId && handleMoveUp(actionModalDayId)}
            >
              <Text style={[s.actionModalBtnText, { color: colors.text }]}>↑ {t("dataMoveUp")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionModalBtn, { backgroundColor: colors.chipBg }]}
              onPress={() => actionModalDayId && handleMoveDown(actionModalDayId)}
            >
              <Text style={[s.actionModalBtnText, { color: colors.text }]}>↓ {t("dataMoveDown")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionModalBtn, { backgroundColor: colors.pastelRed }]}
              onPress={() => actionModalDayId && handleDeleteDay(actionModalDayId)}
            >
              <Text style={[s.actionModalBtnText, { color: colors.text }]}>{t("dataDeleteRow")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionModalBtn, { backgroundColor: colors.secondaryBtn, marginTop: 8 }]}
              onPress={() => setActionModalDayId(null)}
            >
              <Text style={[s.actionModalBtnText, { color: colors.text }]}>{t("cancel")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add product modal */}
      <Modal visible={!!addProductModal} animationType="slide" transparent>
        <Pressable style={g.modalOverlay} onPress={() => setAddProductModal(null)}>
          <Pressable style={g.modal} onPress={(e) => e.stopPropagation()}>
            <Text style={g.modalTitle}>
              {t("dataAddProduct")} — {addProductModal ? mealLabel(addProductModal.mealType) : ""}
            </Text>
            <TextInput
              style={[g.input, { color: colors.text, marginBottom: 12 }]}
              value={newProduct}
              onChangeText={setNewProduct}
              onFocus={() => setActiveProductField("modal")}
              placeholder={t("product")}
              placeholderTextColor={colors.placeholder}
              autoFocus
            />
            <View style={s.modalSuggestionsRow}>
              {getProductSuggestions(newProduct).map((suggestion) => (
                <TouchableOpacity
                  key={`modal-product-${suggestion}`}
                  style={[s.suggestionChip, { backgroundColor: colors.chipBg }]}
                  onPress={() => setNewProduct(suggestion)}
                >
                  <Text style={[s.suggestionChipText, { color: colors.text }]}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[g.input, { color: colors.text, marginBottom: 12 }]}
              value={newGrams}
              onChangeText={setNewGrams}
              onFocus={() => setActiveGramsField("modal")}
              placeholder={`${t("dataAmount")} (${t("grams")})`}
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
            />
            <View style={s.modalSuggestionsRow}>
              {getGramSuggestions(newGrams, recentGrams[0] ?? 0).map((gram) => (
                <TouchableOpacity
                  key={`modal-gram-${gram}`}
                  style={[s.gramChip, { backgroundColor: colors.chipBg }]}
                  onPress={() => setNewGrams(String(gram))}
                >
                  <Text style={[s.gramChipText, { color: colors.text }]}>{gram}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={g.modalButtons}>
              <TouchableOpacity style={g.cancelBtn} onPress={() => setAddProductModal(null)}>
                <Text style={g.cancelBtnText}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[g.saveBtn, !newProduct.trim() && g.buttonDisabled]}
                onPress={confirmAddProduct}
                disabled={!newProduct.trim()}
              >
                <Text style={g.saveBtnText}>{t("add")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={startDateModalVisible} animationType="fade" transparent>
        <Pressable style={g.modalOverlay} onPress={() => setStartDateModalVisible(false)}>
          <Pressable style={g.modal} onPress={(e) => e.stopPropagation()}>
            <Text style={g.modalTitle}>{t("dataStartDateTitle")}</Text>
            <Text style={[g.labelMuted, { marginBottom: 10 }]}>{t("dataStartDateHint")}</Text>
            <TextInput
              style={[g.input, { color: colors.text, marginBottom: 12 }]}
              value={newStartDate}
              onChangeText={setNewStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={g.modalButtons}>
              <TouchableOpacity style={g.cancelBtn} onPress={() => setStartDateModalVisible(false)}>
                <Text style={g.cancelBtnText}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={g.saveBtn} onPress={handleApplyStartDate}>
                <Text style={g.saveBtnText}>{t("save")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!toast} animationType="none" transparent statusBarTranslucent>
        <View style={s.toastLayer} pointerEvents="none">
          {toast && (
            <View
              style={[
                s.toast,
                { top: insets.top + 8 },
                toast.kind === "success"
                  ? { backgroundColor: colors.pastelGreen, borderColor: colors.primary }
                  : { backgroundColor: colors.pastelRed, borderColor: colors.danger },
              ]}
            >
              <Text style={[s.toastText, { color: colors.text }]}>{toast.text}</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function useStyles(colors: {
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  chipBg: string;
  border: string;
  borderLight: string;
  danger: string;
  pastelGreen: string;
  pastelRed: string;
}, width: number) {
  const compact = width < 400;
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        toolbar: {
          flexDirection: "row",
          gap: compact ? 6 : 8,
          paddingHorizontal: spacing.screenPadding,
          marginBottom: 12,
          flexWrap: "wrap",
        },
        toolBtn: {
          paddingVertical: compact ? 9 : 10,
          paddingHorizontal: compact ? 12 : 14,
          borderRadius: spacing.radiusMd,
        },
        toolBtnText: {
          fontSize: 13,
          fontFamily: fonts.medium,
        },
        toolBtnTextWhite: {
          fontSize: 13,
          fontFamily: fonts.semiBold,
          color: "#fff",
        },
        emptyWrap: {
          alignItems: "center",
          padding: 40,
        },
        emptyIcon: {
          fontSize: 40,
          marginBottom: 12,
        },
        tableWrap: {
          paddingHorizontal: spacing.screenPadding,
          minWidth: "100%",
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          paddingVertical: compact ? 8 : 10,
          paddingHorizontal: compact ? 6 : 8,
          gap: compact ? 3 : 4,
        },
        headerText: {
          fontSize: 12,
          fontFamily: fonts.medium,
        },
        row: {
          flexDirection: "row",
          alignItems: "flex-start",
          borderWidth: 1,
          borderTopWidth: 0,
          paddingVertical: compact ? 6 : 8,
          paddingHorizontal: compact ? 6 : 8,
          gap: compact ? 3 : 4,
        },
        colDay: { width: compact ? 92 : 100 },
        colFood: { width: compact ? 140 : 150 },
        colGrams: { width: compact ? 60 : 64 },
        colNotes: { width: compact ? 108 : 120 },
        cellInput: {
          borderWidth: 1,
          borderRadius: spacing.radiusSm,
          paddingVertical: compact ? 5 : 6,
          paddingHorizontal: compact ? 7 : 8,
          fontSize: 13,
          fontFamily: fonts.regular,
        },
        cellDate: { width: "100%" },
        cellProduct: { flex: 1, minWidth: 0 },
        cellGrams: { width: "100%", textAlign: "right" },
        cellNotes: { width: "100%", minHeight: 36 },
        mealEntryRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          width: "100%",
          gap: 2,
          marginBottom: 2,
          flexWrap: "wrap",
        },
        removeEntryBtn: {
          width: 22,
          height: 22,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
        },
        removeEntryText: {
          fontSize: 16,
          fontWeight: "bold",
        },
        addEntryBtn: {
          borderWidth: 1,
          borderStyle: "dashed",
          borderRadius: spacing.radiusSm,
          paddingVertical: 6,
          alignItems: "center",
        },
        addEntryText: {
          fontSize: 16,
          fontFamily: fonts.medium,
        },
        addMoreBtn: {
          paddingVertical: 3,
          alignItems: "center",
        },
        addMoreText: {
          fontSize: 12,
          fontFamily: fonts.medium,
        },
        suggestionsWrap: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
          borderWidth: 1,
          borderRadius: spacing.radiusSm,
          padding: 4,
          width: "100%",
          marginTop: 4,
        },
        inlineSuggestionsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
          marginTop: 2,
          marginBottom: 4,
        },
        modalSuggestionsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 12,
        },
        suggestionChip: {
          borderRadius: spacing.radiusSm,
          paddingHorizontal: 8,
          paddingVertical: 5,
        },
        suggestionChipText: {
          fontSize: 12,
          fontFamily: fonts.medium,
        },
        gramChip: {
          borderRadius: spacing.radiusSm,
          paddingHorizontal: 8,
          paddingVertical: 5,
        },
        gramChipText: {
          fontSize: 12,
          fontFamily: fonts.medium,
        },
        rowActionsBtn: {
          marginTop: 6,
          width: "100%",
          height: 30,
          borderRadius: spacing.radiusSm,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        rowActionsIcon: {
          fontSize: 14,
          fontFamily: fonts.semiBold,
        },
        actionsModal: {
          gap: 8,
        },
        actionModalBtn: {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: spacing.radiusMd,
          alignItems: "center",
        },
        actionModalBtnText: {
          fontSize: 15,
          fontFamily: fonts.medium,
        },
        toast: {
          position: "absolute",
          alignSelf: "center",
          width: "92%",
          maxWidth: 460,
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          paddingVertical: 10,
          paddingHorizontal: 12,
          zIndex: 1000,
          elevation: 1000,
        },
        toastLayer: {
          flex: 1,
          width: "100%",
        },
        toastText: {
          fontSize: 13,
          fontFamily: fonts.medium,
          textAlign: "center",
        },
      }),
    [colors, compact],
  );
}
