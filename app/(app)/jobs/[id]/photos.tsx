import React, { useEffect, useRef, useState } from 'react';
import { Alert, View, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useColors } from '@/hooks/useColors';
import { cardShadow } from '@/components/ui/Card';
import { usePhotosStore } from '@/store/photosStore';
import PhotoGrid from '@/components/camera/PhotoGrid';
import PhotoCaptureSheet, { PhotoCaptureSheetRef } from '@/components/camera/PhotoCaptureSheet';
import { getJobById } from '@/lib/database';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function PhotosScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = usePhotosStore();
  const sheetRef = useRef<PhotoCaptureSheetRef>(null);

  const [propertyId, setPropertyId] = useState<string>('');


  useEffect(() => {
    if (jobId) {
      // BUG 26 FIX: reset store state before loading so previous job's photos don't flash
      store.loadPhotos(jobId);
      const job = getJobById<{ property_id: string }>(jobId);
      if (job) setPropertyId(job.property_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  /** Long-press handler — confirms then deletes photo from SQLite + syncs */
  const handlePhotoLongPress = (photo: { id: string }) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            store.deletePhoto(photo.id);
            Toast.show({ type: 'success', text1: 'Photo deleted' });
          },
        },
      ]
    );
  };

  if (store.isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader curved={true} title="Job Photos" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader 
        curved={true} 
        title="Job Photos" 
        showBack={true} 
        rightComponent={
          store.photos.length > 0 ? (
            <View style={[s.countBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={s.countText}>{store.photos.length} photo{store.photos.length !== 1 ? 's' : ''}</Text>
            </View>
          ) : null
        } 
      />

      <PhotoGrid photos={store.photos} onPhotoLongPress={handlePhotoLongPress} />

      <TouchableOpacity style={[s.fab, { backgroundColor: C.accent }, cardShadow]} activeOpacity={0.9} onPress={() => sheetRef.current?.open()}>
        <MaterialCommunityIcons name="camera" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <PhotoCaptureSheet ref={sheetRef} jobId={jobId as string} propertyId={propertyId} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  fab: { 
    position: 'absolute', 
    bottom: Platform.OS === 'ios' ? 40 : 28, 
    right: 20, 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
});
