import { StyleSheet, Platform } from 'react-native';

/**
 * SiteTrack Global Stylesheet
 * 
 * Provides centralized utility classes for typography, spacing, flexbox layouts,
 * and structural components to ensure visual consistency across the mobile app.
 */

export const G = StyleSheet.create({
  // ─── Core Layouts ───────────────────────────────────────────────────
  container: { flex: 1 },
  safeAreaTop: { paddingTop: Platform.OS === 'android' ? 24 : 0 },
  
  // Flexbox Layouts
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowEnd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  col: { flexDirection: 'column' },
  center: { alignItems: 'center', justifyContent: 'center' },
  alignCenter: { alignItems: 'center' },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  
  // ─── Spacing (Padding) ──────────────────────────────────────────────
  p0:  { padding: 0 },
  p4:  { padding: 4 },
  p8:  { padding: 8 },
  p12: { padding: 12 },
  p16: { padding: 16 },
  p20: { padding: 20 },
  p24: { padding: 24 },
  p32: { padding: 32 },
  
  px8:  { paddingHorizontal: 8 },
  px12: { paddingHorizontal: 12 },
  px16: { paddingHorizontal: 16 },
  px20: { paddingHorizontal: 20 },
  px24: { paddingHorizontal: 24 },
  
  py8:  { paddingVertical: 8 },
  py12: { paddingVertical: 12 },
  py16: { paddingVertical: 16 },
  py20: { paddingVertical: 20 },
  
  // ─── Spacing (Margin) ───────────────────────────────────────────────
  m0:  { margin: 0 },
  mb4:  { marginBottom: 4 },
  mb8:  { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  mb20: { marginBottom: 20 },
  mb24: { marginBottom: 24 },
  mb32: { marginBottom: 32 },
  
  mt4:  { marginTop: 4 },
  mt8:  { marginTop: 8 },
  mt16: { marginTop: 16 },
  mt24: { marginTop: 24 },
  
  mr8:  { marginRight: 8 },
  mr16: { marginRight: 16 },
  ml8:  { marginLeft: 8 },
  ml16: { marginLeft: 16 },
  
  // ─── Gaps ───────────────────────────────────────────────────────────
  gap4:  { gap: 4 },
  gap8:  { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  gap20: { gap: 20 },
  gap24: { gap: 24 },
  
  // ─── Typography ─────────────────────────────────────────────────────
  // Colors should be applied via the useColors() hook in components
  fontHeavy:   { fontWeight: '900' },
  fontBold:    { fontWeight: '800' },
  fontSemibold:{ fontWeight: '700' },
  fontMedium:  { fontWeight: '600' },
  fontNormal:  { fontWeight: '400' },
  
  textXl:    { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  textLg:    { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  textBase:  { fontSize: 16, fontWeight: '700' },
  textBody:  { fontSize: 14, fontWeight: '600' },
  textSm:    { fontSize: 13, fontWeight: '500' },
  textXs:    { fontSize: 12, fontWeight: '500' },
  textTiny:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  
  textCenter: { textAlign: 'center' },
  textRight:  { textAlign: 'right' },
  
  // ─── Components / Surfaces ──────────────────────────────────────────
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardSm: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardLg: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  
  cardShadow: {
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  heavyShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  
  badge: {
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
