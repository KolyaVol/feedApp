import React, { useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Platform,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSchedule } from "../hooks/useSchedule";
import { cancelDailyPlanNotifications } from "../notifications/schedule";
import { fonts, spacing } from "../theme";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { dateToTime, timeToDate } from "../utils/date";
import { syncMonthToGithub } from "../remoteFeed/githubSync";

export function MainScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const { hideSubstitutions } = usePreferences();
  const styles = useLocalStyles(colors);
  const {
    schedules,
    loading,
    refresh,
    todayPlan,
    remoteToday,
    allowedProductsForCurrentDay,
    remoteDayPlans,
    planDays,
    getScheduleForDay,
    progressDateStr,
    updateAllPlanDaysTime,
    shiftMealTypeTimeline,
    shiftProductTimeline,
    toggleMealEatenForDate,
    isMealEaten,
    isProductEaten,
    dayEatenByDate,
    shiftedMealsByDate,
    displacedByDate,
    revertShiftAtSlot,
    replaceShiftedMealAtSlot,
    replaceMealsBulk,
  } = useSchedule();

  const tipPickedRef = useRef(false);
  const [safetyTip, setSafetyTip] = React.useState<string | undefined>();
  const [changeTimeModalVisible, setChangeTimeModalVisible] = React.useState(false);
  const [changeTimeValue, setChangeTimeValue] = React.useState(() => new Date());
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [shiftModalVisible, setShiftModalVisible] = React.useState(false);
  const [shiftMode, setShiftMode] = React.useState<"meal" | "product">("meal");
  const [shiftMealType, setShiftMealType] = React.useState<"morning" | "lunch" | "evening">("morning");
  const [shiftProduct, setShiftProduct] = React.useState("");
  const [shiftDaysText, setShiftDaysText] = React.useState("1");
  const [shifting, setShifting] = React.useState(false);
  const [replaceModalVisible, setReplaceModalVisible] = React.useState(false);
  const [replaceMealType, setReplaceMealType] = React.useState<"morning" | "lunch" | "evening">("morning");
  const [replaceProduct, setReplaceProduct] = React.useState("");
  const [replaceAmountText, setReplaceAmountText] = React.useState("0");
  const [replacing, setReplacing] = React.useState(false);
  const [replaceInStreak, setReplaceInStreak] = React.useState(false);
  const [syncToast, setSyncToast] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);

  const allSeenProducts = useMemo(() => {
    const seen = new Map<string, string>();
    const add = (p: string) => {
      const key = p.trim().toLowerCase();
      if (!key) return;
      if (!seen.has(key)) seen.set(key, p.trim());
    };
    for (const d of remoteDayPlans) for (const m of d.meals) add(m.product);
    for (const d of planDays) add(d.food);
    return [...seen.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => {
        const ea = !!isProductEaten(a.key);
        const eb = !!isProductEaten(b.key);
        if (ea !== eb) return ea ? -1 : 1;
        return a.label.localeCompare(b.label, locale, { sensitivity: "base" });
      });
  }, [isProductEaten, locale, planDays, remoteDayPlans]);

  const replaceProductIsEaten = useMemo(() => isProductEaten(replaceProduct), [isProductEaten, replaceProduct]);

  useFocusEffect(
    useCallback(() => {
      tipPickedRef.current = false;
      refresh();
      cancelDailyPlanNotifications();
    }, [refresh]),
  );

  useEffect(() => {
    if (tipPickedRef.current) return;
    const allTips = schedules.flatMap((s) => s.safetyGuidelines);
    if (allTips.length) {
      setSafetyTip(allTips[Math.floor(Math.random() * allTips.length)]);
      tipPickedRef.current = true;
    }
  }, [schedules]);

  const plan = todayPlan();
  const schedule = plan ? getScheduleForDay(plan) : undefined;

  const dayNumber = useMemo(() => {
    if (!schedule || !plan) return null;
    const start = new Date(schedule.startDate + "T00:00:00").getTime();
    const cur = new Date(plan.date + "T00:00:00").getTime();
    const diffDays = Math.floor((cur - start) / 86400000);
    return diffDays + 1;
  }, [plan, schedule]);

  const orderedMeals = useMemo(() => {
    const dayPlan = remoteDayPlans.find((d) => d.date === progressDateStr);
    const displaced = displacedByDate[progressDateStr] ?? {};
    const order = { morning: 0, lunch: 1, evening: 2 } as const;
    const grouped = (["morning", "lunch", "evening"] as const).map((type) => {
      const items = (dayPlan?.meals ?? [])
        .filter((meal) => meal.mealType === type)
        .map((meal) => ({ product: meal.product, amount_grams: meal.amountGrams }));
      return {
        type,
        items,
        time: undefined as string | undefined,
        skeleton: items.length === 0 && !!displaced[type],
      };
    });
    return grouped.sort((a, b) => order[a.type] - order[b.type]);
  }, [displacedByDate, progressDateStr, remoteDayPlans]);

  const mealLabel = useCallback(
    (type: "morning" | "lunch" | "evening") => {
      if (type === "morning") return t("mealBreakfast");
      if (type === "lunch") return t("mealLunch");
      return t("mealEvening");
    },
    [t],
  );

  const openShiftModal = useCallback(
    (type: "morning" | "lunch" | "evening", product?: string) => {
      setShiftMealType(type);
      setShiftProduct(product ?? "");
      setShiftMode(product ? "product" : "meal");
      setShiftDaysText("1");
      setShiftModalVisible(true);
    },
    [],
  );

  const saveShift = useCallback(async () => {
    const days = parseInt(shiftDaysText.trim(), 10);
    if (!Number.isFinite(days) || days === 0) return;
    setShifting(true);
    if (shiftMode === "meal") {
      await shiftMealTypeTimeline(shiftMealType, days, progressDateStr);
    } else {
      await shiftProductTimeline(shiftMealType, shiftProduct, days, progressDateStr);
    }
    setShifting(false);
    setShiftModalVisible(false);
  }, [
    progressDateStr,
    shiftDaysText,
    shiftMealType,
    shiftMode,
    shiftProduct,
    shiftMealTypeTimeline,
    shiftProductTimeline,
  ]);

  const openReplaceModal = useCallback((mealType: "morning" | "lunch" | "evening") => {
    const displaced = displacedByDate[progressDateStr]?.[mealType]?.meal;
    const currentDay = remoteDayPlans.find((d) => d.date === progressDateStr);
    const currentMeal = currentDay?.meals.find((m) => m.mealType === mealType);
    setReplaceMealType(mealType);
    setReplaceProduct(displaced?.product ?? currentMeal?.product ?? "");
    setReplaceAmountText(String(displaced?.amountGrams ?? currentMeal?.amountGrams ?? 0));
    setReplaceInStreak(false);
    setReplaceModalVisible(true);
  }, [displacedByDate, progressDateStr, remoteDayPlans]);

  const saveReplacement = useCallback(async () => {
    const amount = parseInt(replaceAmountText.trim(), 10);
    if (!replaceProduct.trim() || !Number.isFinite(amount) || amount < 0) return;
    setReplacing(true);
    const replacementsForSync: Array<{ date: string; mealType: "morning" | "lunch" | "evening"; product: string; amountGrams: number }> = [];
    if (replaceInStreak && !replaceProductIsEaten) {
      const day = remoteDayPlans.find((d) => d.date === progressDateStr);
      const meal = day?.meals.find((m) => m.mealType === replaceMealType);
      const originalProduct = meal?.product?.trim();
      if (originalProduct) {
        const items: Array<{ date: string; mealType: typeof replaceMealType; product: string; amountGrams: number }> = [];
        for (const d of remoteDayPlans) {
          if (d.date < progressDateStr) continue;
          const m = d.meals.find((x) => x.mealType === replaceMealType);
          if (!m) continue;
          if (m.product.trim() !== originalProduct) continue;
          items.push({ date: d.date, mealType: replaceMealType, product: replaceProduct, amountGrams: m.amountGrams });
        }
        if (items.length) {
          items[0] = { ...items[0], amountGrams: amount };
          await replaceMealsBulk(items);
          replacementsForSync.push(...items);
        } else {
          await replaceShiftedMealAtSlot(progressDateStr, replaceMealType, replaceProduct, amount);
          replacementsForSync.push({ date: progressDateStr, mealType: replaceMealType, product: replaceProduct, amountGrams: amount });
        }
      } else {
        await replaceShiftedMealAtSlot(progressDateStr, replaceMealType, replaceProduct, amount);
        replacementsForSync.push({ date: progressDateStr, mealType: replaceMealType, product: replaceProduct, amountGrams: amount });
      }
    } else {
      await replaceShiftedMealAtSlot(progressDateStr, replaceMealType, replaceProduct, amount);
      replacementsForSync.push({ date: progressDateStr, mealType: replaceMealType, product: replaceProduct, amountGrams: amount });
    }
    setReplacing(false);
    setReplaceModalVisible(false);

    const uniqueByDate = new Map<string, { date: string; mealType: "morning" | "lunch" | "evening"; product: string; amountGrams: number }>();
    for (const item of replacementsForSync) uniqueByDate.set(`${item.date}:${item.mealType}`, item);
    const byMonth = new Map<number, Array<{ date: string; mealType: "morning" | "lunch" | "evening"; product: string; amountGrams: number }>>();
    for (const item of uniqueByDate.values()) {
      const day = remoteDayPlans.find((d) => d.date === item.date);
      if (!day) continue;
      const list = byMonth.get(day.sourceMonth) ?? [];
      list.push(item);
      byMonth.set(day.sourceMonth, list);
    }
    let failed = false;
    for (const [month, monthItems] of byMonth) {
      const days = monthItems
        .map((item) => {
          const day = remoteDayPlans.find((d) => d.date === item.date);
          if (!day) return null;
          const meals = day.meals.map((m) =>
            m.mealType === item.mealType ? { ...m, product: item.product, amountGrams: item.amountGrams } : m,
          );
          if (!meals.some((m) => m.mealType === item.mealType)) {
            meals.push({ mealType: item.mealType, product: item.product, amountGrams: item.amountGrams });
          }
          const morning = meals.find((m) => m.mealType === "morning");
          const lunch = meals.filter((m) => m.mealType === "lunch");
          const evening = meals.filter((m) => m.mealType === "evening");
          return {
            weekNumber: day.weekNumber,
            dayNumber: day.dayNumber,
            morning: morning ? { product: morning.product, amountGrams: morning.amountGrams } : undefined,
            lunch: lunch.map((m) => ({ product: m.product, amountGrams: m.amountGrams })),
            evening: evening.map((m) => ({ product: m.product, amountGrams: m.amountGrams })),
            notes: day.notes ?? "",
          };
        })
        .filter(Boolean);
      if (!days.length) continue;
      const result = await syncMonthToGithub({
        month,
        days,
        message: `Replace ${replaceMealType} on ${progressDateStr}`,
      });
      if (!result.ok) {
        failed = true;
        setSyncToast({ kind: "error", text: `GitHub sync failed: ${result.text}` });
        break;
      }
    }
    if (!failed && byMonth.size > 0) {
      setSyncToast({ kind: "success", text: "Replacements synced to GitHub" });
    }
  }, [
    progressDateStr,
    replaceAmountText,
    replaceInStreak,
    replaceMealType,
    replaceMealsBulk,
    replaceProduct,
    replaceProductIsEaten,
    replaceShiftedMealAtSlot,
    remoteDayPlans,
  ]);

  useEffect(() => {
    if (!syncToast) return;
    const timer = setTimeout(() => setSyncToast(null), 2600);
    return () => clearTimeout(timer);
  }, [syncToast]);

  const todayStr = useMemo(() => {
    const now = new Date(progressDateStr + "T00:00:00");
    return now.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [locale, progressDateStr]);

  const productPastelColor = useCallback(
    (product: string) => {
      const p = product.toLowerCase();
      if (
        p.includes("брокколи") ||
        p.includes("кабач") ||
        p.includes("капуст") ||
        p.includes("тыкв") ||
        p.includes("морков") ||
        p.includes("картоф")
      ) {
        return colors.pastelGreen;
      }
      if (p.includes("рис") || p.includes("греч") || p.includes("кукуруз")) {
        return colors.pastelYellow;
      }
      if (p.includes("яблок") || p.includes("груш")) {
        return colors.pastelOrange;
      }
      if (p.includes("индей") || p.includes("кролик") || p.includes("куриц")) {
        return colors.pastelRed;
      }
      return colors.chipBg;
    },
    [colors],
  );

  const todayHeader = useMemo(() => {
    return dayNumber ? `${todayStr} · ${t("loadDataDay")} ${dayNumber}` : todayStr;
  }, [dayNumber, t, todayStr]);

  const daysRemainingAlert = useMemo(() => {
    const end = schedule?.endDate;
    if (!end) return null;
    const endMs = new Date(end + "T00:00:00").getTime();
    const curMs = new Date(progressDateStr + "T00:00:00").getTime();
    const days = Math.floor((endMs - curMs) / 86400000);
    if (days > 7) return null;
    if (days <= 3) return { level: "red" as const, days };
    if (days <= 5) return { level: "orange" as const, days };
    return { level: "yellow" as const, days };
  }, [schedule?.endDate, progressDateStr]);

  const openChangeAllDaysTime = useCallback(() => {
    if (!plan) return;
    setChangeTimeValue(timeToDate(plan.time));
    setShowTimePicker(Platform.OS === "ios");
    setChangeTimeModalVisible(true);
  }, [plan]);

  const saveAllDaysTime = useCallback(async () => {
    const time = dateToTime(changeTimeValue);
    await updateAllPlanDaysTime(time);
    setChangeTimeModalVisible(false);
    setShowTimePicker(false);
  }, [changeTimeValue, updateAllPlanDaysTime]);

  if (loading) {
    return (
      <View style={[g.screenContainer, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!plan && !remoteToday) {
    return (
      <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
        <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
          {t("mainScreenTitle")}
        </Text>
        <Text style={styles.dateHeader}>{todayHeader}</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={g.emptyText}>{t("mainNoPlan")}</Text>
          <Text style={[g.labelMuted, styles.emptyHint]}>
            {t("mainNoPlanHint")}
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={g.screenContainer} contentContainerStyle={g.screenContent}>
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
        {t("mainScreenTitle")}
      </Text>
      <Text style={styles.dateHeader}>{todayHeader}</Text>

      {daysRemainingAlert ? (
        <View
          style={[
            styles.updateDataAlert,
            {
              backgroundColor:
                daysRemainingAlert.level === "red"
                  ? colors.pastelRed
                  : daysRemainingAlert.level === "orange"
                    ? colors.pastelOrange
                    : colors.pastelYellow,
            },
          ]}
        >
          <Text style={[styles.updateDataAlertText, { color: colors.text }]}>
            {t("mainDaysRemainingAlert", { count: Math.max(0, daysRemainingAlert.days) })}
          </Text>
        </View>
      ) : null}

      {orderedMeals.length ? (
        orderedMeals.map((meal) => (
          <View
            key={meal.type}
            style={[
              styles.mainCard,
              meal.skeleton && { backgroundColor: colors.pastelOrange, borderWidth: 1, borderColor: colors.border },
              dayEatenByDate[progressDateStr]
                ? { backgroundColor: colors.pastelGreen }
                : isMealEaten(progressDateStr, meal.type, meal.items[0]?.product)
                  ? { backgroundColor: colors.pastelYellow }
                  : undefined,
            ]}
          >
            <Text style={styles.foodTypeLabel}>{mealLabel(meal.type)}</Text>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnShift, { borderColor: colors.border, marginBottom: 10 }]}
              onPress={() => openReplaceModal(meal.type)}
            >
              <Text style={styles.actionBtnText}>{t("mainAddExtraProduct")}</Text>
            </TouchableOpacity>
            {meal.items.length ? (
              <Text style={styles.foodName}>{meal.items.map((x) => x.product).join(" + ")}</Text>
            ) : (
              <Text style={styles.emptyMealText}>{meal.skeleton ? t("mainShiftSkeletonTitle") : t("mainMealSlotEmpty")}</Text>
            )}
            <View style={styles.detailsRow}>
              {meal.items.length ? (
                <View style={styles.detailBadge}>
                  <Text style={styles.detailBadgeText}>
                    {meal.items.reduce((s, x) => s + x.amount_grams, 0)}
                    {t("mainGrams")}
                  </Text>
                </View>
              ) : null}
              {meal.time ? (
                <View style={styles.detailBadge}>
                  <Text style={styles.detailBadgeText}>⏰ {meal.time}</Text>
                </View>
              ) : null}
              {shiftedMealsByDate[progressDateStr]?.[meal.type] ? (
                <View style={styles.detailBadge}>
                  <Text style={styles.detailBadgeText}>{t("mainShifted")}</Text>
                </View>
              ) : null}
              {isMealEaten(progressDateStr, meal.type, meal.items[0]?.product) ? (
                <View style={styles.detailBadge}>
                  <Text style={styles.detailBadgeText}>{t("mainEaten")}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.actionsRow}>
              {meal.skeleton ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnShift, { borderColor: colors.border }]}
                    onPress={() => revertShiftAtSlot(progressDateStr, meal.type)}
                  >
                    <Text style={styles.actionBtnText}>{t("mainShiftRevert")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnEaten]}
                    onPress={() => openReplaceModal(meal.type)}
                  >
                    <Text style={styles.actionBtnText}>{t("mainShiftReplace")}</Text>
                  </TouchableOpacity>
                </>
              ) : !meal.items.length ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnEaten]}
                  onPress={() => openReplaceModal(meal.type)}
                >
                  <Text style={styles.actionBtnText}>{t("mainShiftReplace")}</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnShift, { borderColor: colors.border }]}
                    onPress={() => openShiftModal(meal.type, meal.items[0]?.product)}
                  >
                    <Text style={styles.actionBtnText}>{t("mainShiftModeMeal")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnEaten]}
                    onPress={() => openReplaceModal(meal.type)}
                  >
                    <Text style={styles.actionBtnText}>{t("mainShiftReplace")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.actionBtnEaten,
                      isMealEaten(progressDateStr, meal.type, meal.items[0]?.product) && { backgroundColor: colors.pastelGreen },
                    ]}
                    onPress={() => toggleMealEatenForDate(progressDateStr, meal.type, meal.items[0]?.product)}
                  >
                    <Text style={styles.actionBtnText}>
                      {isMealEaten(progressDateStr, meal.type, meal.items[0]?.product) ? t("mainUnsetEaten") : t("mainSetEaten")}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))
      ) : (
        <View style={styles.mainCard}>
          <Text style={styles.foodTypeLabel}>{plan?.foodType}</Text>
          <Text style={styles.foodName}>{plan?.food}</Text>
          <View style={styles.detailsRow}>
            <View style={styles.detailBadge}>
              <Text style={styles.detailBadgeText}>
                {plan?.amountGrams}{t("mainGrams")}
              </Text>
            </View>
            <View style={styles.detailBadge}>
              <TouchableOpacity onPress={openChangeAllDaysTime}>
                <Text style={styles.detailBadgeText}>⏰ {plan?.time}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.detailBadge}>
              <Text style={styles.detailBadgeText}>
                {t("mainWeek")} {plan?.weekNumber}
              </Text>
            </View>
          </View>
        </View>
      )}

      {!hideSubstitutions && plan && plan.substitutions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mainSubstitutions")}</Text>
          <View style={styles.chipsRow}>
            {plan.substitutions.map((sub, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{sub}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {plan?.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mainNotes")}</Text>
          <View style={styles.noteCard}>
            <Text style={styles.noteText}>{plan.notes}</Text>
          </View>
        </View>
      ) : null}

      {allowedProductsForCurrentDay.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mainAllowedProducts")}</Text>
          <View style={styles.allowedProductsRow}>
            {allowedProductsForCurrentDay.map((product) => (
              <View
                key={product}
                style={[styles.allowedProductChip, { backgroundColor: productPastelColor(product) }]}
              >
                <Text style={styles.allowedProductText}>{product}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {remoteToday?.advice?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mainSafetyTip")}</Text>
          <View style={styles.tipCard}>
            {remoteToday.advice.slice(0, 2).map((tip, idx) => (
              <Text key={`${idx}-${tip}`} style={styles.tipText}>💡 {tip}</Text>
            ))}
          </View>
        </View>
      ) : safetyTip ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mainSafetyTip")}</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>💡 {safetyTip}</Text>
          </View>
        </View>
      ) : null}
      <Modal visible={changeTimeModalVisible} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={g.modal}>
            <Text style={g.modalTitle}>{t("mainChangeAllDaysTimeTitle")}</Text>
            <TouchableOpacity
              style={styles.timeRow}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={[g.labelMuted, styles.timeLabel]}>
                {t("mainChangeAllDaysTimeLabel")}
              </Text>
              <Text style={g.textBody}>{dateToTime(changeTimeValue)}</Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={changeTimeValue}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, d) => {
                  if (d) setChangeTimeValue(d);
                  setShowTimePicker(Platform.OS === "ios");
                }}
              />
            )}
            <View style={g.modalButtons}>
              <TouchableOpacity
                style={g.cancelBtn}
                onPress={() => {
                  setChangeTimeModalVisible(false);
                  setShowTimePicker(false);
                }}
              >
                <Text style={g.cancelBtnText}>{t("remindersCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={g.saveBtn} onPress={saveAllDaysTime}>
                <Text style={g.saveBtnText}>{t("mainChangeAllDaysTimeSave")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={shiftModalVisible} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={g.modal}>
            <Text style={g.modalTitle}>{t("mainShiftMealProductTitle")}</Text>
            <View style={styles.detailsRow}>
              <TouchableOpacity
                style={styles.detailBadge}
                onPress={() => setShiftMode("meal")}
              >
                <Text style={styles.detailBadgeText}>
                  {shiftMode === "meal" ? t("mainShiftModeMealSelected") : t("mainShiftModeMeal")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailBadge}
                onPress={() => setShiftMode("product")}
              >
                <Text style={styles.detailBadgeText}>
                  {shiftMode === "product" ? t("mainShiftModeProductSelected") : t("mainShiftModeProduct")}
                </Text>
              </TouchableOpacity>
            </View>
            {shiftMode === "product" ? (
              <>
                <Text style={styles.inputLabel}>{t("mainShiftProductLabel")}</Text>
                <TextInput
                  style={[g.input, { marginTop: 8, color: colors.text, backgroundColor: colors.card }]}
                  value={shiftProduct}
                  onChangeText={setShiftProduct}
                  placeholder={t("mainShiftProductPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.primary}
                />
              </>
            ) : null}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>{t("mainShiftDaysLabel")}</Text>
            <TextInput
              style={[g.input, { marginTop: 8, color: colors.text, backgroundColor: colors.card }]}
              value={shiftDaysText}
              onChangeText={setShiftDaysText}
              keyboardType="numeric"
              placeholder={t("mainShiftDaysPlaceholder")}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
            />
            <View style={[g.modalButtons, { marginTop: 12 }]}>
              <TouchableOpacity
                style={g.cancelBtn}
                onPress={() => setShiftModalVisible(false)}
              >
                <Text style={g.cancelBtnText}>{t("remindersCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[g.saveBtn, shifting && g.buttonDisabled]}
                onPress={saveShift}
                disabled={shifting}
              >
                <Text style={g.saveBtnText}>{shifting ? t("mainShiftSaving") : t("mainShiftApply")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={replaceModalVisible} animationType="slide" transparent>
        <View style={g.modalOverlay}>
          <View style={g.modal}>
            <Text style={g.modalTitle}>{t("mainShiftReplaceTitle")}</Text>
            <Text style={styles.inputLabel}>{t("mainShiftProductLabel")}</Text>
            <ScrollView style={{ maxHeight: 220, marginTop: 10 }}>
              <View style={styles.chipsRow}>
                {allSeenProducts.map((p) => {
                  const selected = p.label === replaceProduct;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => {
                        setReplaceProduct(p.label);
                        if (isProductEaten(p.label)) setReplaceInStreak(false);
                      }}
                      style={[
                        styles.chip,
                        selected && { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.chipBg },
                      ]}
                    >
                      <Text style={[styles.chipText, selected && { color: colors.primary }]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>{t("mainShiftAmountLabel")}</Text>
            <TextInput
              style={[g.input, { marginTop: 8, color: colors.text, backgroundColor: colors.card }]}
              value={replaceAmountText}
              onChangeText={setReplaceAmountText}
              keyboardType="numeric"
              placeholder={t("loadDataAmount")}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
            />
            {!replaceProductIsEaten && (
              <TouchableOpacity
                style={[styles.detailBadge, { marginTop: 12, alignSelf: "flex-start" }]}
                onPress={() => setReplaceInStreak((v) => !v)}
              >
                <Text style={styles.detailBadgeText}>
                  {replaceInStreak ? `${t("mainShiftReplace")} · streak` : "Replace in streak"}
                </Text>
              </TouchableOpacity>
            )}
            <View style={[g.modalButtons, { marginTop: 12 }]}>
              <TouchableOpacity style={g.cancelBtn} onPress={() => setReplaceModalVisible(false)}>
                <Text style={g.cancelBtnText}>{t("remindersCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[g.saveBtn, replacing && g.buttonDisabled]}
                onPress={saveReplacement}
                disabled={replacing}
              >
                <Text style={g.saveBtnText}>{replacing ? t("mainShiftSaving") : t("mainShiftApply")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {syncToast ? (
        <View
          style={[
            styles.toast,
            syncToast.kind === "success"
              ? { backgroundColor: colors.pastelGreen, borderColor: colors.primary }
              : { backgroundColor: colors.chipBg, borderColor: colors.pastelRed },
          ]}
        >
          <Text style={[styles.toastText, { color: colors.text }]}>{syncToast.text}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function useLocalStyles(colors: {
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  chipBg: string;
  border: string;
  background: string;
  pastelGreen: string;
  pastelYellow: string;
  pastelOrange: string;
  pastelRed: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        dateHeader: {
          fontSize: 15,
          color: colors.textMuted,
          fontFamily: fonts.medium,
          paddingHorizontal: spacing.screenPadding,
          marginBottom: 16,
          textTransform: "capitalize",
        },
        updateDataAlert: {
          marginHorizontal: spacing.screenPadding,
          marginBottom: 16,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: spacing.radiusMd,
        },
        updateDataAlertText: {
          fontSize: 15,
          fontFamily: fonts.medium,
          textAlign: "center",
        },
        mainCard: {
          marginHorizontal: spacing.screenPadding,
          backgroundColor: colors.card,
          borderRadius: spacing.radiusLg,
          padding: 20,
          alignItems: "center",
          marginBottom: 16,
        },
        foodTypeLabel: {
          fontSize: 13,
          color: colors.textMuted,
          fontFamily: fonts.regular,
          marginBottom: 6,
          textAlign: "center",
        },
        foodName: {
          fontSize: 28,
          fontWeight: "700",
          color: colors.text,
          fontFamily: fonts.bold,
          marginBottom: 14,
          textTransform: "capitalize",
          textAlign: "center",
        },
        detailsRow: {
          flexDirection: "row",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        },
        actionsRow: {
          width: "100%",
          marginTop: 12,
          gap: 10,
        },
        actionBtn: {
          width: "100%",
          borderRadius: spacing.radiusMd,
          paddingVertical: 10,
          paddingHorizontal: 12,
          alignItems: "center",
          justifyContent: "center",
        },
        actionBtnShift: {
          backgroundColor: colors.chipBg,
          borderWidth: 1,
        },
        actionBtnEaten: {
          backgroundColor: colors.pastelYellow,
        },
        actionBtnText: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.medium,
          textAlign: "center",
        },
        detailBadge: {
          backgroundColor: colors.chipBg,
          paddingVertical: 6,
          paddingHorizontal: 14,
          borderRadius: spacing.radiusChip,
        },
        detailBadgeText: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.medium,
        },
        timeRow: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 20,
        },
        timeLabel: { marginRight: 12 },
        inputLabel: {
          fontSize: 13,
          color: colors.textMuted,
          fontFamily: fonts.medium,
        },
        section: {
          marginHorizontal: spacing.screenPadding,
          marginBottom: 16,
        },
        sectionTitle: {
          fontSize: 15,
          fontWeight: "600",
          color: colors.text,
          fontFamily: fonts.semiBold,
          marginBottom: 8,
        },
        chipsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        },
        allowedProductsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        },
        chip: {
          backgroundColor: colors.chipBg,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: spacing.radiusChip,
        },
        allowedProductChip: {
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: spacing.radiusChip,
        },
        allowedProductText: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.regular,
          textTransform: "capitalize",
        },
        chipText: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.regular,
          textTransform: "capitalize",
        },
        noteCard: {
          backgroundColor: colors.card,
          borderRadius: spacing.radiusMd,
          padding: 14,
        },
        noteText: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.regular,
          lineHeight: 20,
        },
        tipCard: {
          backgroundColor: colors.pastelYellow,
          borderRadius: spacing.radiusMd,
          padding: 14,
        },
        tipText: {
          fontSize: 14,
          color: colors.text,
          fontFamily: fonts.regular,
          lineHeight: 20,
        },
        emptyCard: {
          margin: spacing.screenPadding,
          backgroundColor: colors.card,
          borderRadius: spacing.radiusLg,
          padding: 32,
          alignItems: "center",
        },
        emptyIcon: {
          fontSize: 40,
          marginBottom: 12,
        },
        emptyHint: {
          marginTop: 8,
          textAlign: "center",
        },
        emptyMealText: {
          fontSize: 16,
          color: colors.textMuted,
          fontFamily: fonts.medium,
          marginBottom: 14,
          textAlign: "center",
        },
        toast: {
          marginHorizontal: spacing.screenPadding,
          marginBottom: 10,
          borderWidth: 1,
          borderRadius: spacing.radiusMd,
          paddingVertical: 10,
          paddingHorizontal: 12,
        },
        toastText: {
          fontSize: 13,
          fontFamily: fonts.medium,
          textAlign: "center",
        },
      }),
    [colors],
  );
}
