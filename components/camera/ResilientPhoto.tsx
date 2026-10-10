import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getValidLocalUri } from '@/utils/fileHelpers';
import { resignPhotoNow } from '@/lib/photoUpload';
import { queryRecords } from '@/lib/database';
import { useColors } from '@/hooks/useColors';

interface Props extends Omit<ImageProps, 'source' | 'onError'> {
  /**
   * inspection_photos.id — lets a load failure re-sign against the right
   * row directly. Optional: some callers (e.g. DefectCard, which only has
   * the denormalized `defects.photos: string[]` mirror, not the underlying
   * inspection_photos rows) don't have this to hand. When omitted, the id
   * is looked up locally by matching `uri` against inspection_photos.
   * photo_url before re-signing — one extra local SQLite read on failure
   * only, never on the successful/common path.
   */
  photoId?: string;
  /** The stored photo_url (or a local file:// URI) exactly as loaded. */
  uri: string;
}

/**
 * Drop-in replacement for `<Image source={{ uri: getValidLocalUri(uri) }} />`
 * that recovers from an expired signed URL instead of showing a
 * permanently broken image.
 *
 * FIX: refreshPhotoUrlsOnView (lib/photoUpload.ts) extends a photo's link
 * every time a screen displays it — but only AFTER it's already rendered
 * successfully, so it can extend a link that still works, never fix one
 * that's already expired by the time this exact render happens (a photo
 * nobody's opened in longer than its TTL). This is the other half: on a
 * real load failure, try re-signing this one photo and swap in the fresh
 * URL. Retries at most once per mount — a photo that's broken for some
 * OTHER reason (the file genuinely deleted from Storage, no network at
 * all) still just shows as broken, exactly like before, instead of
 * hammering the resign endpoint in a loop.
 *
 * Also defaults `transition` to a 200ms fade-in and `cachePolicy` to
 * 'memory-disk' (both overridable via props) — no image anywhere in the
 * app specified either, so every photo popped in abruptly with no fade,
 * and relied on expo-image's own default ('disk') rather than an explicit
 * memory+disk cache. The same photo shows up in a grid AND a detail/
 * lightbox view constantly in this app; an in-memory hit avoids a disk
 * read + re-decode every time that happens in the same session.
 */
export default function ResilientPhoto({ photoId, uri, transition = 200, cachePolicy = 'memory-disk', style, ...imageProps }: Props) {
  const C = useColors();
  const [displayUri, setDisplayUri] = useState(() => getValidLocalUri(uri));
  const [hasRetried, setHasRetried] = useState(false);
  // FIX: a load failure (expired signed URL) used to just render nothing —
  // the Image stayed fully transparent, indistinguishable from "still
  // loading" or "no photo at all" against whatever background sat behind
  // it (several callers give this box no background of its own). Tracked
  // separately from hasRetried so the one-time resign attempt still gets a
  // chance to swap in a working URL before this ever shows.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setDisplayUri(getValidLocalUri(uri));
    setHasRetried(false);
    setFailed(false);
  }, [uri]);

  const handleError = useCallback(() => {
    if (hasRetried) { setFailed(true); return; }
    setHasRetried(true);
    // Resolve the id by matching photo_url when the caller didn't have one
    // to hand — see the prop's own comment for why that happens.
    const resolvedId = photoId ?? queryRecords<{ id: string }>('inspection_photos', { photo_url: uri })[0]?.id;
    if (!resolvedId) { setFailed(true); return; } // no matching row (e.g. a local file:// URI, or already deleted) — nothing to re-sign
    void resignPhotoNow(resolvedId, uri).then((fresh) => {
      if (fresh) setDisplayUri(fresh);
      else setFailed(true);
    });
  }, [photoId, uri, hasRetried]);

  return (
    <View style={[styles.wrap, { backgroundColor: C.backgroundTertiary }, style]}>
      {failed ? (
        <MaterialCommunityIcons name="image-off-outline" size={20} color={C.textTertiary} />
      ) : (
        <Image
          {...imageProps}
          style={styles.fill}
          transition={transition}
          cachePolicy={cachePolicy}
          source={{ uri: displayUri }}
          onError={handleError}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
});
