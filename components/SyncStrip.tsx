// SyncStrip — the thin full-width status line attached under every screen
// header (ScreenHeader). Replaces the old floating OfflineBanner, which sat
// on top of the header and hid the title and back button for as long as
// the phone was offline. Same pattern as Teams/Outlook/Slack: a slim strip
// below the header that pushes the screen down instead of covering it.
// What it shows comes from hooks/useSyncStrip.ts — always the real queue.
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/ui/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useSyncStrip, refreshSyncStrip } from '@/hooks/useSyncStrip';
import { retryAllFailedSyncItems, runSync } from '@/lib/sync';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function SyncStrip() {
  const C = useColors();
  const s = useSyncStrip();
  if (s.kind === 'hidden') return null;

  let bg: string, fg: string, icon: keyof typeof MaterialCommunityIcons.glyphMap, title: string, detail: string | null = null;
  let progress: number | null = null;
  let onPress: (() => void) | undefined;

  switch (s.kind) {
    case 'offline':
      bg = C.warningLight; fg = C.warningDark; icon = 'cloud-off-outline';
      title = "You're offline";
      detail = s.unsynced > 0
        ? `${plural(s.unsynced, 'change', 'changes')} saved on this phone`
        : 'Changes will save on this phone';
      break;
    case 'uploading':
      bg = C.infoLight; fg = C.infoDark; icon = 'cloud-upload-outline';
      title = 'Uploading changes';
      detail = `${s.done} of ${s.total}`;
      progress = s.total > 0 ? s.done / s.total : 0;
      break;
    case 'done':
      bg = C.successLight; fg = C.successDark; icon = 'cloud-check-outline';
      title = 'All changes uploaded';
      break;
    case 'failed':
      bg = C.errorLight; fg = C.errorDark; icon = 'cloud-alert-outline';
      title = `${plural(s.failed, "change couldn't", "changes couldn't")} upload`;
      detail = 'Retry';
      onPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        retryAllFailedSyncItems();
        refreshSyncStrip();
        void runSync().finally(refreshSyncStrip);
      };
      break;
  }

  const body = (
    <>
      <View style={styles.row}>
        <MaterialCommunityIcons name={icon} size={18} color={fg} />
        <Text style={[styles.title, { color: fg }]} numberOfLines={1}>{title}</Text>
        {detail ? (
          <Text
            style={[styles.detail, { color: fg }, s.kind === 'failed' && styles.action]}
            numberOfLines={1}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {progress !== null ? (
        <View style={styles.track}>
          <View style={[styles.fill, { backgroundColor: fg, width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}
    </>
  );

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={{ backgroundColor: bg }}>
      {onPress ? (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${title}. Tap to retry.`}
        >
          {body}
        </TouchableOpacity>
      ) : (
        <View accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={detail ? `${title}, ${detail}` : title}>
          {body}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 40,
  },
  title: { fontSize: 13.5, fontWeight: '600', flexShrink: 1 },
  detail: { fontSize: 13.5, fontWeight: '500', marginLeft: 'auto', flexShrink: 1, fontVariant: ['tabular-nums'] },
  action: { fontWeight: '700', textDecorationLine: 'underline' },
  track: { height: 2 },
  fill: { height: 2 },
});
