import React, { useCallback, useEffect, useState } from 'react';
import { Image, ImageProps } from 'expo-image';
import { getValidLocalUri } from '@/utils/fileHelpers';
import { resignPhotoNow } from '@/lib/photoUpload';

interface Props extends Omit<ImageProps, 'source' | 'onError'> {
  /** inspection_photos.id — required to re-sign against the right row. */
  photoId: string;
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
 */
export default function ResilientPhoto({ photoId, uri, ...imageProps }: Props) {
  const [displayUri, setDisplayUri] = useState(() => getValidLocalUri(uri));
  const [hasRetried, setHasRetried] = useState(false);

  useEffect(() => {
    setDisplayUri(getValidLocalUri(uri));
    setHasRetried(false);
  }, [uri]);

  const handleError = useCallback(() => {
    if (hasRetried) return;
    setHasRetried(true);
    void resignPhotoNow(photoId, uri).then((fresh) => {
      if (fresh) setDisplayUri(fresh);
    });
  }, [photoId, uri, hasRetried]);

  return <Image {...imageProps} source={{ uri: displayUri }} onError={handleError} />;
}
