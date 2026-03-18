import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { useGlobalStyles } from "../globalStyles";
import { fonts, spacing } from "../theme";
import { useRemoteFeedContext } from "../remoteFeed/RemoteFeedContext";

export function RemoteFeedScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useLocalStyles(colors);
  const remote = useRemoteFeedContext();
  const [refreshing, setRefreshing] = useState(false);

  const today = remote?.today ?? null;
  const loading = remote?.loading ?? false;
  const error = remote?.error ?? null;

  const onRefresh = useCallback(async () => {
    if (!remote) return;
    setRefreshing(true);
    try {
      await remote.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [remote]);

  const dateLabel = useMemo(() => {
    if (!today?.date) return null;
    const d = new Date(today.date + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [today?.date]);

  if (loading && !today) {
    return (
      <View style={[g.screenContainer, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={g.screenContainer}>
      <ScrollView
        contentContainerStyle={g.screenContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
          {t("screenTitlesRemoteFeed")}
        </Text>

        {error ? (
          <View style={[styles.messageBox, { borderColor: colors.borderLight }]}>
            <Text style={styles.messageText}>{error}</Text>
          </View>
        ) : null}

        {!today ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No feed data</Text>
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.dateText}>{dateLabel ?? today.date}</Text>
            {today.meals.map((m, idx) => (
              <View key={`${m.time}-${idx}`} style={styles.mealRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeText}>{m.time}</Text>
                </View>
                <View style={styles.mealInfo}>
                  <Text style={styles.foodText}>{m.food}</Text>
                  {m.notes ? <Text style={styles.notesText}>{m.notes}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function useLocalStyles(colors: {
  card: string;
  borderLight: string;
  text: string;
  textMuted: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { justifyContent: "center", alignItems: "center" },
        content: { paddingHorizontal: spacing.screenPadding },
        dateText: {
          fontSize: 16,
          fontFamily: fonts.semiBold,
          color: colors.text,
          marginBottom: 10,
        },
        mealRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderLight,
        },
        timeCol: { width: 64, paddingRight: 10 },
        timeText: {
          fontSize: 14,
          fontFamily: fonts.medium,
          color: colors.textMuted,
        },
        mealInfo: { flex: 1 },
        foodText: { fontSize: 16, fontFamily: fonts.medium, color: colors.text },
        notesText: { marginTop: 2, fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted },
        emptyBox: {
          marginHorizontal: spacing.screenPadding,
          marginTop: 12,
          padding: 14,
          borderRadius: spacing.radiusMd,
          backgroundColor: colors.card,
        },
        emptyText: { fontFamily: fonts.regular, color: colors.textMuted },
        messageBox: {
          marginHorizontal: spacing.screenPadding,
          marginTop: 8,
          marginBottom: 8,
          padding: 12,
          borderRadius: spacing.radiusMd,
          borderWidth: StyleSheet.hairlineWidth,
        },
        messageText: { fontFamily: fonts.regular, color: colors.textMuted },
      }),
    [colors],
  );
}

