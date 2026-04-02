// Profile screen — navy curved header + avatar + role pill + info cards + destructive sign out
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import Colors from '@/constants/Colors';

type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type MenuRow = {
  id: string;
  icon: MCIcon;
  label: string;
  sub?: string;
  action: () => void;
  danger?: boolean;
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const initials = (user?.full_name ?? 'T')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const [showSignOut, setShowSignOut] = useState(false);

  const handleSignOut = () => {
    setShowSignOut(false);
    signOut();
  };

  const menuSections: { title: string; items: MenuRow[] }[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'email',
          icon: 'email-outline',
          label: user?.email ?? 'No email',
          sub: 'Email address',
          action: () => {},
        },
        {
          id: 'phone',
          icon: 'phone-outline',
          label: user?.phone ?? 'No phone set',
          sub: 'Mobile number',
          action: () => {},
        },
      ],
    },
    {
      title: 'App',
      items: [
        {
          id: 'sync',
          icon: 'sync',
          label: 'Sync Data Now',
          sub: 'Force a manual sync with cloud',
          action: () => Alert.alert('Sync', 'Manual sync triggered'),
        },
        {
          id: 'offline',
          icon: 'wifi-off',
          label: 'Offline Mode',
          sub: 'App works without internet',
          action: () => {},
        },
        {
          id: 'biometrics',
          icon: 'fingerprint',
          label: 'Biometric Login',
          sub: 'Face ID / Fingerprint enabled',
          action: () => {},
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          id: 'version',
          icon: 'information-outline',
          label: 'SiteTrack v1.0.0',
          sub: 'Field Service Management',
          action: () => {},
        },
        {
          id: 'support',
          icon: 'lifebuoy',
          label: 'Support',
          sub: 'Get help with the app',
          action: () => Alert.alert('Support', 'Contact: support@sitetrack.com.au'),
        },
      ],
    },
  ];

  return (
    <View style={s.screen}>

      {/* ── Navy Curved Header ───────────── */}
      <View style={s.header}>
        {/* Avatar circle */}
        <View style={s.avatarOuter}>
          <View style={s.avatarInner}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
        </View>

        {/* Name + role */}
        <Text style={s.headerName}>{user?.full_name ?? 'Technician'}</Text>
        <View style={s.rolePill}>
          <Text style={s.roleText}>
            {user?.role === 'technician' ? '🔥 Field Technician' : '🔧 Subcontractor'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Info Sections ────────────────── */}
        {menuSections.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title.toUpperCase()}</Text>
            <View style={s.card}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.id}
                  style={[s.menuRow, i < section.items.length - 1 && s.menuRowBorder]}
                  onPress={item.action}
                  activeOpacity={0.7}
                >
                  <View style={[s.menuIconWrap, item.danger && s.menuIconWrapDanger]}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={18}
                      color={item.danger ? Colors.light.error : Colors.light.primary}
                    />
                  </View>
                  <View style={s.menuText}>
                    <Text style={[s.menuLabel, item.danger && s.menuLabelDanger]}>
                      {item.label}
                    </Text>
                    {item.sub ? <Text style={s.menuSub}>{item.sub}</Text> : null}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.light.border} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* ── Sign Out — destructive outline button ── */}
        <TouchableOpacity
          style={s.signOutBtn}
          onPress={() => setShowSignOut(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="logout" size={18} color={Colors.light.error} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Sign Out Bottom Sheet Modal ── */}
      <Modal visible={showSignOut} transparent animationType="fade" onRequestClose={() => setShowSignOut(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowSignOut(false)} />
          <View style={s.bottomSheet}>
            <View style={s.bsHandle} />
            <Text style={s.bsTitle}>Sign Out?</Text>
            <Text style={s.bsSub}>You&apos;ll need to sign in again next time.</Text>
            <View style={{ height: 24 }} />
            <TouchableOpacity style={s.bsBtnRed} onPress={handleSignOut} activeOpacity={0.8}>
              <Text style={s.bsBtnRedText}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.bsBtnGrey} onPress={() => setShowSignOut(false)} activeOpacity={0.8}>
              <Text style={s.bsBtnGreyText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ height: 16 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },

  // Navy curved header
  header: {
    backgroundColor: Colors.light.primary,
    paddingTop: 56,
    paddingBottom: 48,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: 'center',
    gap: 8,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },

  // Avatar — outer ring + inner solid
  avatarOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(249,115,22,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },

  headerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  // Role pill — orange
  rolePill: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  scroll: { padding: 16, gap: 0 },

  // Section
  section:      { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // White card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  // Menu rows
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    minHeight: 56,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.background,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconWrapDanger: { backgroundColor: Colors.light.errorLight },
  menuText:     { flex: 1 },
  menuLabel:    { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  menuLabelDanger: { color: Colors.light.error },
  menuSub:      { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },

  // Sign out — red outline, no fill
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: Colors.light.error,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.error,
  },

  // Bottom Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32, // safe area padding
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  bsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 20,
    marginTop: -8,
  },
  bsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  bsSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  bsBtnRed: {
    backgroundColor: '#EF4444',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bsBtnRedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bsBtnGrey: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  bsBtnGreyText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
});
