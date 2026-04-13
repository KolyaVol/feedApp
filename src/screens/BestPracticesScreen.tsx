import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBestPractices } from "../hooks/useBestPractices";
import { useGlobalStyles } from "../globalStyles";
import { useTheme } from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { fonts, spacing } from "../theme";

export function BestPracticesScreen() {
  const insets = useSafeAreaInsets();
  const g = useGlobalStyles();
  const { t } = useLocale();
  const { colors } = useTheme();
  const s = useStyles(colors);
  const { data, loading, error, refresh } = useBestPractices();

  if (loading && !data) {
    return (
      <View style={[g.screenContainer, s.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[g.labelMuted, { marginTop: 12 }]}>{t("guideLoading")}</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <ScrollView
        style={g.screenContainer}
        contentContainerStyle={[g.screenContent, s.center]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
          {t("titleGuide")}
        </Text>
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>📖</Text>
          <Text style={g.emptyText}>{error ?? t("guideNoData")}</Text>
          <Text style={[g.labelMuted, { textAlign: "center", marginTop: 6 }]}>
            {t("guideNoDataHint")}
          </Text>
          <TouchableOpacity style={[s.refreshBtn, { backgroundColor: colors.primary }]} onPress={refresh}>
            <Text style={s.refreshBtnText}>{t("guideRefresh")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={g.screenContainer}
      contentContainerStyle={g.screenContent}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <Text style={[g.screenTitle, { paddingTop: insets.top + 8 }]}>
        {t("titleGuide")}
      </Text>

      {/* Safety Tips */}
      {data.safetyTips.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            {t("guideSafetyTips")}
          </Text>
          {data.safetyTips.map((tip, idx) => (
            <View key={idx} style={[s.tipCard, { backgroundColor: colors.pastelYellow }]}>
              <Text style={[s.tipText, { color: colors.text }]}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Product Introduction Order */}
      {data.productOrder.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            {t("guideProductOrder")}
          </Text>
          <View style={[s.tableCard, { backgroundColor: colors.card }]}>
            {data.productOrder.map((item, idx) => (
              <View
                key={idx}
                style={[
                  s.productRow,
                  idx < data.productOrder.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.borderLight,
                  },
                ]}
              >
                <View style={s.productNum}>
                  <Text style={[s.productNumText, { color: colors.primary }]}>{idx + 1}</Text>
                </View>
                <View style={s.productInfo}>
                  <Text style={[s.productName, { color: colors.text }]}>{item.product}</Text>
                  <Text style={[s.productAge, { color: colors.textMuted }]}>
                    {item.ageMonths} {t("guideMonths")}
                  </Text>
                </View>
                {item.notes ? (
                  <Text style={[s.productNote, { color: colors.textMuted }]}>{item.notes}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Portion Guide */}
      {data.portionGuide.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            {t("guidePortionGuide")}
          </Text>
          <View style={[s.tableCard, { backgroundColor: colors.card }]}>
            {data.portionGuide.map((item, idx) => (
              <View
                key={idx}
                style={[
                  s.portionRow,
                  idx < data.portionGuide.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.borderLight,
                  },
                ]}
              >
                <Text style={[s.portionAge, { color: colors.text }]}>
                  {item.ageMonths} {t("guideMonths")}
                </Text>
                <Text style={[s.portionMeal, { color: colors.textMuted }]}>
                  {item.mealType}
                </Text>
                <Text style={[s.portionGrams, { color: colors.primary }]}>
                  {item.grams}{t("grams")}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Additional Sections */}
      {data.sections.map((section, sIdx) => (
        <View key={sIdx} style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            {section.title}
          </Text>
          {section.items.map((item, idx) => (
            <View key={idx} style={[s.sectionItem, { backgroundColor: colors.card }]}>
              <Text style={[s.sectionItemText, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      ))}

      {data.updatedAt && (
        <Text style={[s.updatedAt, { color: colors.textMuted }]}>
          Updated: {new Date(data.updatedAt).toLocaleDateString()}
        </Text>
      )}
    </ScrollView>
  );
}

function useStyles(colors: {
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  borderLight: string;
  pastelYellow: string;
}) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        emptyWrap: {
          alignItems: "center",
          padding: 40,
        },
        emptyIcon: {
          fontSize: 40,
          marginBottom: 12,
        },
        refreshBtn: {
          marginTop: 16,
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: spacing.radiusMd,
        },
        refreshBtnText: {
          color: "#fff",
          fontSize: 15,
          fontFamily: fonts.semiBold,
        },
        section: {
          marginBottom: 16,
          paddingHorizontal: spacing.screenPadding,
        },
        sectionTitle: {
          fontSize: 17,
          fontWeight: "600",
          fontFamily: fonts.semiBold,
          marginBottom: 10,
        },
        tipCard: {
          borderRadius: spacing.radiusMd,
          padding: 14,
          marginBottom: 8,
        },
        tipText: {
          fontSize: 14,
          fontFamily: fonts.regular,
          lineHeight: 20,
        },
        tableCard: {
          borderRadius: spacing.radiusLg,
          overflow: "hidden",
        },
        productRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 14,
        },
        productNum: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "rgba(74,158,255,0.12)",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        },
        productNumText: {
          fontSize: 13,
          fontFamily: fonts.semiBold,
        },
        productInfo: {
          flex: 1,
        },
        productName: {
          fontSize: 15,
          fontFamily: fonts.medium,
          textTransform: "capitalize",
        },
        productAge: {
          fontSize: 12,
          fontFamily: fonts.regular,
          marginTop: 2,
        },
        productNote: {
          fontSize: 12,
          fontFamily: fonts.regular,
          maxWidth: 120,
          textAlign: "right",
        },
        portionRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 14,
        },
        portionAge: {
          width: 60,
          fontSize: 14,
          fontFamily: fonts.medium,
        },
        portionMeal: {
          flex: 1,
          fontSize: 14,
          fontFamily: fonts.regular,
          textTransform: "capitalize",
        },
        portionGrams: {
          fontSize: 15,
          fontFamily: fonts.semiBold,
        },
        sectionItem: {
          borderRadius: spacing.radiusMd,
          padding: 14,
          marginBottom: 6,
        },
        sectionItemText: {
          fontSize: 14,
          fontFamily: fonts.regular,
          lineHeight: 20,
        },
        updatedAt: {
          fontSize: 12,
          fontFamily: fonts.regular,
          textAlign: "center",
          paddingVertical: 16,
        },
      }),
    [colors],
  );
}
