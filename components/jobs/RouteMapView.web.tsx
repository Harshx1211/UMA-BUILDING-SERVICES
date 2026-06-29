// RouteMapView.web.tsx — stub for web builds to avoid react-native-maps native import error
// react-native-maps uses native-only modules that can't run on web/SSR.
// Expo Metro will use THIS file on web, and RouteMapView.tsx on native.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RouteMapView() {
  return (
    <View style={s.wrap}>
      <Text style={s.text}>Map not available on web</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FA' },
  text: { fontSize: 13, color: '#8898AA' },
});
