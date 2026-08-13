# SiteTrack App — Exhaustive File-by-File Technical Reference

> This document provides a 100% exhaustive breakdown of every single file in the SiteTrack codebase, including all exported functions, components, hooks, constants, and the explicit technical logic contained within each file.

## 📂 Complete Folder Structure

```text
[app]
├── (app)
│   ├── defects
│   │   └── index.tsx
│   ├── help.tsx
│   ├── index.tsx
│   ├── jobs
│   │   ├── index.tsx
│   │   ├── [id]
│   │   │   ├── defects
│   │   │   │   └── [defectId].tsx
│   │   │   ├── defects.tsx
│   │   │   ├── index.tsx
│   │   │   ├── inspect.tsx
│   │   │   ├── photos.tsx
│   │   │   ├── preview.tsx
│   │   │   ├── quote.tsx
│   │   │   ├── report.tsx
│   │   │   └── signature.tsx
│   │   └── _layout.tsx
│   ├── notifications
│   │   └── index.tsx
│   ├── profile.tsx
│   ├── properties
│   │   ├── site-inspect
│   │   │   ├── [id].tsx
│   │   │   └── _layout.tsx
│   │   ├── [id].tsx
│   │   └── _layout.tsx
│   └── _layout.tsx
├── (auth)
│   ├── forgot-password.tsx
│   ├── index.tsx
│   ├── login.tsx
│   └── _layout.tsx
└── _layout.tsx
[components]
├── camera
│   ├── index.ts
│   ├── PhotoCaptureSheet.tsx
│   └── PhotoGrid.tsx
├── defects
│   ├── AddDefectSheet.tsx
│   ├── DefectCard.tsx
│   ├── DefectCodePicker.tsx
│   └── index.ts
├── inspections
│   ├── AddAssetModal.tsx
│   ├── AssetInspectModal.tsx
│   ├── ChecklistModal.tsx
│   ├── EditAssetModal.tsx
│   └── index.ts
├── jobs
│   ├── CompletionBottomSheet.tsx
│   ├── index.ts
│   ├── JobCard.tsx
│   ├── JobTypeBadge.tsx
│   ├── RouteMapView.tsx
│   ├── RouteMapView.web.tsx
│   ├── SignatureModal.tsx
│   └── StatusBadge.tsx
├── OfflineBanner.tsx
├── SyncStatusBar.tsx
└── ui
    ├── Badge.tsx
    ├── Button.tsx
    ├── Card.tsx
    ├── EmptyState.tsx
    ├── FilterPills.tsx
    ├── FormField.tsx
    ├── index.ts
    ├── Input.tsx
    ├── ScreenHeader.tsx
    ├── SectionHeader.tsx
    ├── SectionTitle.tsx
    └── SkeletonCard.tsx
[constants]
├── AssetData.ts
├── Checklists.ts
├── Colors.ts
├── Company.ts
├── Config.ts
├── DefectCodes.ts
├── Enums.ts
├── headerPad.ts
└── Typography.ts
[hooks]
├── use-color-scheme.ts
├── use-color-scheme.web.ts
├── use-theme-color.ts
├── useAuth.ts
├── useColors.ts
└── useNetworkStatus.ts
[lib]
├── database.ts
├── notifications.ts
├── pdfConstants.ts
├── pdfGenerator.ts
├── photoUpload.ts
├── quoteTemplate.ts
├── reportTemplate.ts
├── supabase.ts
└── sync.ts
[store]
├── authStore.ts
├── catalogueStore.ts
├── dashboardStore.ts
├── defectsStore.ts
├── inspectionStore.ts
├── inventoryStore.ts
├── jobsStore.ts
├── notificationsStore.ts
├── photosStore.ts
└── quotesStore.ts
[types]
└── index.ts
[utils]
├── assetHelpers.ts
├── fileHelpers.ts
├── sanitize.ts
└── uuid.ts
[supabase/migrations]
├── add_property_next_inspection.sql
├── catalogue_migration.sql
├── fix_photo_delete_rls.sql
├── fix_reports_storage.sql
├── multi_tenant_catalogue_patch.sql
├── multi_tenant_catalogue_upgrade.sql
├── schema.sql
├── settings_patch.sql
├── sitetrack_audit_extend.sql
├── sitetrack_audit_patch.sql
├── sitetrack_dynamic_sidebar.sql
├── SUPABASE_ASSETS_DEFECTS.sql
└── users_compliance_patch.sql
```

---

# 📁 `app/` Directory

## 📄 `app/(app)/defects/index.tsx`

> **Description:** Global Defects Screen — app/(app)/defects/index.tsx Cross-job view of all defects with filtering, status badges, and navigation to detail.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function GlobalDefectsScreen`
```tsx
export default function GlobalDefectsScreen() {
  const C = useColors();
  const { defects, isLoading, loadAllDefects } = useDefectsStore();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all');

  const load = useCallback(() => {
    loadAllDefects();
  }, [loadAllDefects]);

  // H1: Load once on mount + subscribe to sync events— no wasteful full-scan on every tab visit
  useEffect(() => {
    load();
    onSyncComplete(load);
    return () => offSyncComplete(load);
  }, [load]);

  const filtered = useMemo(() =>
    (defects as ExtendedDefect[]).filter(d => {
      if (severityFilter !== 'all' && d.severity !== severityFilter) return false;
      if (statusFilter   !== 'all' && d.status   !== statusFilter)   return false;
      return true;
    })
  , [defects, severityFilter, statusFilter]);

  const openCount     = useMemo(() => defects.filter(d => d.status === DefectStatus.Open).length, [defects]);
  const criticalCount = useMemo(() => defects.filter(d => d.severity === DefectSeverity.Critical).length, [defects]);

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="DEFECTS"
        title="All Defects"
        subtitle={`${defects.length} total · ${openCount} open · ${criticalCount} critical`}
        showBack
        rightComponent={
          openCount > 0 ? (
            <View style={[s.openCountBadge, { backgroundColor: C.error + '33', borderColor: C.error + '66' }]}>
              <Text style={[s.openCountTxt, { color: C.error }]}>{openCount} OPEN</Text>
            </View>
          ) : (
            <View style={[s.openCountBadge, { backgroundColor: C.success + '33', borderColor: C.success + '66' }]}>
              <Text style={[s.openCountTxt, { color: C.success }]}>ALL CLEAR</Text>
            </View>
          )
        }
      />

      {/* Severity filters */}
      <Animated.View entering={FadeInDown.delay(40).duration(300)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          <FilterPill label="All Severity" isActive={severityFilter === 'all'} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverityFilter('all'); }} C={C} />
          <FilterPill label="🔴 Critical" isActive={severityFilter === DefectSeverity.Critical} color={SEVERITY_COLORS[DefectSeverity.Critical]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverityFilter(DefectSeverity.Critical); }} C={C} />
          <FilterPill label="🟡 Major" isActive={severityFilter === DefectSeverity.Major} color={SEVERITY_COLORS[DefectSeverity.Major]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverityFilter(DefectSeverity.Major); }} C={C} />
          <FilterPill label="🔵 Minor" isActive={severityFilter === DefectSeverity.Minor} color={SEVERITY_COLORS[DefectSeverity.Minor]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverityFilter(DefectSeverity.Minor); }} C={C} />
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.filterRow, { paddingTop: 0 }]}
        >
          <FilterPill label="All Status" isActive={statusFilter === 'all'} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusFilter('all'); }} C={C} />
          <FilterPill label="Open" isActive={statusFilter === DefectStatus.Open} color={STATUS_COLORS[DefectStatus.Open]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusFilter(DefectStatus.Open); }} C={C} />
          <FilterPill label="Monitoring" isActive={statusFilter === DefectStatus.Monitoring} color={STATUS_COLORS[DefectStatus.Monitoring]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusFilter(DefectStatus.Monitoring); }} C={C} />
          <FilterPill label="Quoted" isActive={statusFilter === DefectStatus.Quoted} color={STATUS_COLORS[DefectStatus.Quoted]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusFilter(DefectStatus.Quoted); }} C={C} />
          <FilterPill label="Repaired" isActive={statusFilter === DefectStatus.Repaired} color={STATUS_COLORS[DefectStatus.Repaired]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusFilter(DefectStatus.Repaired); }} C={C} />
        </ScrollView>
      </Animated.View>

      {/* Result count */}
      <View style={[s.resultBar, { backgroundColor: C.backgroundTertiary }]}>
        <Text style={[s.resultTxt, { color: C.textTertiary }]}>
          {filtered.length} of {defects.length} defects
        </Text>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <MaterialCommunityIcons name={defects.length === 0 ? "party-popper" : "magnify"} size={44} color={C.textTertiary} style={{ marginBottom: 10 }} />
          <Text style={[s.emptyTitle, { color: C.text }]}>
            {defects.length === 0 ? 'No defects on record' : 'No results match filters'}
          </Text>
          <Text style={[s.emptySub, { color: C.textSecondary }]}>
            {defects.length === 0
              ? 'All inspections are currently defect-free'
              : 'Try clearing your filters'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={C.primary} />}
          renderItem={({ item, index }) => (
            // M1: Key includes filter state so animation only fires on genuine new items,
            // not on every filter change re-render.
            <Animated.View
              key={item.id + severityFilter + statusFilter}
              entering={FadeInDown.delay(index * 30).duration(350)}
            >
              <DefectRow
                defect={item as ExtendedDefect}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // M4: Guard against null job_id to prevent /jobs/undefined/... navigation
                  if (!item.job_id) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    return;
                  }
                  router.push(`/jobs/${item.job_id}/defects/${item.id}` as never);
                }}
                C={C}
              />
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}
```

*Size: **316** lines of code.*

---

## 📄 `app/(app)/help.tsx`

> **Description:** SiteTrack — Help & Support Screen Accordion guides, FAQ, feedback email, walkthrough replay, app version
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function HelpScreen`
```tsx
export default function HelpScreen() {
  const C = useColors();
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const handleFeedback = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const subject = encodeURIComponent(`SiteTrack Feedback — v${version}`);
    const body    = encodeURIComponent('Hi SiteTrack team,\n\nI have the following feedback:\n\n');
    Linking.openURL(`mailto:support@uma-building-services.com.au?subject=${subject}&body=${body}`);
  }, [version]);

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader 
        title="Help & Support" 
        subtitle={`SiteTrack v${version}`} 
        showBack={true} 
        rightComponent={<MaterialCommunityIcons name="lifebuoy" size={26} color={C.textTertiary} />} 
      />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Walkthrough CTA ── */}
        <Reanimated.View entering={FadeInDown.delay(30).duration(350)}>
          <Card 
            style={[s.walkthroughCard, { borderColor: C.accent + '26', borderWidth: 1.5 }]} 
            noPadding
          >
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowWalkthrough(true); }} activeOpacity={0.8} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={[s.walkthroughIcon, { backgroundColor: C.accentLight }]}>
                <MaterialCommunityIcons name="school-outline" size={26} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.walkthroughTitle, { color: C.text }]}>App Walkthrough</Text>
                <Text style={[s.walkthroughSub, { color: C.textSecondary }]}>4-step guide for new technicians</Text>
              </View>
              <MaterialCommunityIcons name="play-circle-outline" size={28} color={C.accent} />
            </TouchableOpacity>
          </Card>
        </Reanimated.View>

        {/* ── How To Use ── */}
        <Reanimated.View entering={FadeInDown.delay(80).duration(350)} style={s.section}>
          <SectionTitle title="HOW TO USE SiteTrack" />
          {HOW_TO.map(({ item, icon }) => (
            <AccordionCard key={item.id} item={item} icon={icon} />
          ))}
        </Reanimated.View>

        {/* ── FAQ ── */}
        <Reanimated.View entering={FadeInDown.delay(130).duration(350)} style={s.section}>
          <SectionTitle title="FREQUENTLY ASKED QUESTIONS" />
          {FAQ_ITEMS.map(({ item, icon }) => (
            <AccordionCard key={item.id} item={item} icon={icon} />
          ))}
        </Reanimated.View>

        {/* ── Feedback button ── */}
        <Reanimated.View entering={FadeInDown.delay(180).duration(350)}>
          <Button variant="secondary" title="Send Feedback to Support" onPress={handleFeedback} />
        </Reanimated.View>

        {/* ── App info row ── */}
        <Reanimated.View entering={FadeInDown.delay(210).duration(350)}>
          <Card style={s.versionCard}>
            <View style={[s.versionIconWrap, { backgroundColor: C.backgroundTertiary }]}>
              <MaterialCommunityIcons name="fire" size={20} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.versionApp, { color: C.text }]}>SiteTrack — Field Service App</Text>
              <Text style={[s.versionNum, { color: C.textTertiary }]}>Version {version} · Build 1 · Android</Text>
            </View>
          </Card>
          <Text style={[s.legalNote, { color: C.textTertiary }]}>
            Built for Australian fire protection technicians. All data is encrypted and stored securely on Supabase.
          </Text>
        </Reanimated.View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <WalkthroughModal visible={showWalkthrough} onClose={() => setShowWalkthrough(false)} />
    </View>
  );
}
```

*Size: **332** lines of code.*

---

## 📄 `app/(app)/index.tsx`

> **Description:** Home Screen — SiteTrack Design rules enforced here: - All colors from T.* tokens only — zero hardcoded hex values - KPI stat numbers are neutral (T.textPrimary) — not semantic colors - No emoji anywhere in UI copy - Status badges use the shared <Badge> component - Empty state uses <EmptyState> with a vector icon, not a 🎉 - Section labels are sentence-case via <SectionHeader> - Notification bell uses MaterialCommunityIcons, not a 🔔 emoji
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function HomeScreen`
```tsx
export default function HomeScreen() {
  const { user }            = useAuth();
  const { jobs, loadJobs }  = useJobsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const today      = new Date().toISOString().slice(0, 10);
  const todayJobs  = jobs.filter((j: Job) => j.scheduled_date === today);
  const doneToday  = todayJobs.filter((j: Job) => j.status === JobStatus.Completed).length;
  const inProgress = jobs.find((j: Job) => j.status === JobStatus.InProgress);
  const openCount  = jobs.filter((j: Job) =>
    j.status !== JobStatus.Completed && j.status !== JobStatus.Cancelled
  ).length;

  useEffect(() => {
    if (user) {
      loadJobs(user.id);
      setUnreadCount(getUnreadNotificationCount(user.id));
    }

    const onSync = () => {
      if (user) {
        loadJobs(user.id);
        setUnreadCount(getUnreadNotificationCount(user.id));
      }
    };
    onSyncComplete(onSync);

    // Active job pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.025, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,     duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    return () => offSyncComplete(onSync);
  }, [user, loadJobs, pulseAnim]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runSync();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.screen}>
      {/* ── Header ── */}
      <ScreenHeader
        title={`${greeting()}, ${user?.full_name?.split(' ')[0] ?? 'Technician'}`}
        subtitle={todayStr()}
        rightComponent={
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push('/(app)/notifications')}
          >
            <MaterialCommunityIcons
              name={unreadCount > 0 ? 'bell-badge-outline' : 'bell-outline'}
              size={22}
              color={unreadCount > 0 ? T.primary : T.textMuted}
            />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        {/* ── Active Job Banner ── */}
        {inProgress && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: T.space16 }}>
            <Card
              variant="default"
              noPadding
              onPress={() => router.push(`/(app)/jobs/${inProgress.id}`)}
            >
              <View style={styles.activeJobInner}>
                {/* Pulsing orange dot */}
                <View style={styles.activeDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeEyebrow}>Active job</Text>
                  <Text style={styles.activeName} numberOfLines={1}>
                    {(inProgress as JobWithJoins).property_name ?? 'Unknown Property'}
                  </Text>
                </View>
                <View style={styles.activeOpenBtn}>
                  <Text style={styles.activeOpenBtnText}>Open</Text>
                  <MaterialCommunityIcons name="arrow-right" size={14} color={T.primary} />
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* ── KPI Stat Tiles ── */}
        <View style={styles.kpiRow}>
          {[
            { value: todayJobs.length, label: 'Today'     },
            { value: doneToday,        label: 'Done today' },
            { value: openCount,        label: 'Open jobs'  },
          ].map(({ value, label }) => (
            <View key={label} style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{value}</Text>
              <Text style={styles.kpiLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Today's Jobs ── */}
        <View style={styles.section}>
          <SectionHeader title="Today's jobs" style={styles.sectionHeader} />
          {todayJobs.length === 0 ? (
            <Card>
              <EmptyState
                icon="calendar-blank-outline"
                title="No jobs scheduled today"
                subtitle="Your queue is clear. Pull down to refresh."
              />
            </Card>
          ) : (
            todayJobs.map((job: Job, idx: number) => (
              <JobCard key={job.id} job={job} index={idx} />
            ))
          )}
        </View>

        {/* ── Upcoming ── */}
        {(() => {
          const upcoming = jobs.filter((j: Job) => j.scheduled_date > today).slice(0, 5);
          if (!upcoming.length) return null;
          return (
            <View style={styles.section}>
              <SectionHeader title="Upcoming" style={styles.sectionHeader} />
              {upcoming.map((job: Job, idx: number) => (
                <JobCard key={job.id} job={job} index={idx} />
              ))}
            </View>
          );
        })()}
      </ScrollView>
    </View>
  );
}
```

*Size: **467** lines of code.*

---

## 📄 `app/(app)/jobs/index.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function ScheduleScreen`
```tsx
export default function ScheduleScreen() {
  const { user } = useAuth();
  const { jobs, loadJobs } = useJobsStore();
  const [filter, setFilter]     = useState<FilterTab>('today');
  const [search, setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Use local timezone dates
  const getLocalDate = (d: Date = new Date()) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const today = getLocalDate();

  // Calculate Monday and Sunday of current week
  const now       = new Date();
  const dayOfWeek = now.getDay() || 7; // 1 (Mon) to 7 (Sun)

  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const weekStart = getLocalDate(monday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekEnd = getLocalDate(sunday);

  useEffect(() => {
    if (user) loadJobs(user.id);
    const fn = () => { if (user) loadJobs(user.id); };
    onSyncComplete(fn);
    return () => offSyncComplete(fn);
  }, [user, loadJobs]);

  const filtered = useMemo(() => jobs.filter((j: Job) => {
    const effectiveDateStr = j.status === 'completed' ? (j.updated_at || j.scheduled_date) : j.scheduled_date;
    const filterDate = effectiveDateStr.substring(0, 10);
    const scheduledOnlyDate = j.scheduled_date.substring(0, 10);
    const isOverdue = scheduledOnlyDate < today && j.status !== 'completed' && j.status !== 'cancelled';

    if (filter === 'today' && filterDate !== today && !isOverdue) return false;
    if (filter === 'week') {
      const inThisWeek = filterDate >= weekStart && filterDate <= weekEnd;
      if (!isOverdue && !inThisWeek) return false;
    }
    if (search.trim()) {
      const q  = search.toLowerCase();
      const jj = j as JobWithJoins;
      if (!(jj.property_name ?? '').toLowerCase().includes(q) &&
          !(jj.address ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a: Job, b: Job) => {
    const statusOrder = (s: string) =>
      s === 'in_progress' ? 0 : s === 'scheduled' ? 1 : s === 'completed' ? 2 : 3;
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    const dateA = a.status === 'completed' ? (a.updated_at || a.scheduled_date) : a.scheduled_date;
    const dateB = b.status === 'completed' ? (b.updated_at || b.scheduled_date) : b.scheduled_date;
    return dateA.localeCompare(dateB);
  }), [jobs, filter, search, today, weekStart, weekEnd]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runSync();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Schedule"
        subtitle={`${filtered.length} job${filtered.length !== 1 ? 's' : ''} found`}
      />

      {/* ── Filter Tabs ── */}
      <View style={styles.filterRow}>
        {(['today', 'week', 'all'] as FilterTab[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'All Jobs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={16} color={T.textMuted} style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search property or address…"
          placeholderTextColor={T.textMuted}
          value={search}
          onChangeText={setSearch}
          maxLength={80}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={16} color={T.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(job) => job.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        renderItem={({ item }) => <ScheduleJobCard key={item.id} job={item} />}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={8}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="briefcase-search-outline" size={40} color={T.textMuted} />
            <Text style={styles.emptyTitle}>No jobs found</Text>
            <Text style={styles.emptyText}>
              {search ? 'Try a different search term.' : 'No jobs scheduled for this period.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}
```

*Size: **238** lines of code.*

---

## 📄 `app/(app)/jobs/[id]/defects/[defectId].tsx`

> **Description:** Defect Detail Screen — app/(app)/jobs/[id]/defects/[defectId].tsx Access rules: - Job is IN PROGRESS  → read-only info card + Delete button (mistake correction) - Job is COMPLETED    → fully read-only, no delete, locked notice shown - Status changes and pricing are ALWAYS admin-only (no chips on mobile)
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function DefectDetailScreen`
```tsx
export default function DefectDetailScreen() {
  const C = useColors();
  const { defectId } = useLocalSearchParams<{ id: string; defectId: string }>();
  const { deleteDefect } = useDefectsStore();

  const [defect,      setDefect]      = useState<FullDefect | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [jobLocked,   setJobLocked]   = useState(false); // true when job is completed

  const loadDefect = useCallback(() => {
    if (!defectId) return;
    setIsLoading(true);
    const d = getDefectById<FullDefect>(defectId);
    setDefect(d);

    // Determine lock state from the job record
    if (d?.job_id) {
      const job = getJobById<{ status: string }>(d.job_id);
      setJobLocked(job?.status === JobStatus.Completed);
    }
    setIsLoading(false);
  }, [defectId]);

  useEffect(() => { loadDefect(); }, [loadDefect]);

  const handleDelete = () => {
    Alert.alert(
      'Remove Defect',
      'This will permanently remove the defect record. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (!defect) return;
            deleteDefect(defect.id);
            Toast.show({ type: 'success', text1: 'Defect removed' });
            router.back();
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!defect) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <Text style={{ fontSize: 40 }}>🔍</Text>
        <Text style={{ color: C.textSecondary, marginTop: 8 }}>Defect not found</Text>
        <View style={{ marginTop: 16 }}>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const sev        = SEVERITY_CONFIG[defect.severity] ?? SEVERITY_CONFIG[DefectSeverity.Minor];
  const statusColor = STATUS_COLORS[defect.status as DefectStatus] ?? C.textSecondary;
  const codeInfo   = defect.defect_code ? findDefectCode(defect.defect_code) : null;

  let photosArr: string[] = [];
  try {
    photosArr = typeof defect.photos === 'string' ? JSON.parse(defect.photos) : (defect.photos || []);
  } catch { /* ignore */ }

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="DEFECT RECORD"
        title={defect.asset_type ? formatAssetType(defect.asset_type) : 'Defect Details'}
        subtitle={defect.property_name || defect.location_on_site || ''}
        showBack
        rightComponent={
          <View style={[s.statusChip, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
            <View style={[s.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[s.statusChipTxt, { color: statusColor }]}>
              {defect.status.charAt(0).toUpperCase() + defect.status.slice(1)}
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Locked notice — shown when job is completed */}
        {jobLocked && (
          <Animated.View entering={FadeInDown.delay(20).duration(300)}>
            <View style={[s.lockedBanner, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
              <MaterialCommunityIcons name="lock-outline" size={15} color={C.textTertiary} />
              <Text style={[s.lockedTxt, { color: C.textTertiary }]}>
                Quote & status managed by admin · Read-only view
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Severity Banner */}
        <Animated.View entering={FadeInDown.delay(40).duration(380)}>
          <View style={[s.sevBanner, { backgroundColor: sev.bg, borderColor: sev.color + '40' }]}>
            <View style={[s.sevIconWrap, { backgroundColor: sev.color }]}>
              <MaterialCommunityIcons name={sev.icon} size={22} color={C.textOnPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.sevLabel, { color: sev.color }]}>{sev.label.toUpperCase()} DEFECT</Text>
              <Text style={[s.sevDate, { color: sev.color + 'AA' }]}>
                Logged {new Date(defect.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            {defect.quote_price ? (
              <View style={[s.priceBadge, { backgroundColor: C.success + '18', borderColor: C.success + '40' }]}>
                <MaterialCommunityIcons name="tag-outline" size={11} color={C.success} />
                <Text style={[s.priceBadgeTxt, { color: C.success }]}>${defect.quote_price}</Text>
              </View>
            ) : (
              <View style={[s.priceBadge, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
                <MaterialCommunityIcons name="tag-outline" size={11} color={C.textTertiary} />
                <Text style={[s.priceBadgeTxt, { color: C.textTertiary }]}>Unquoted</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Defect Code */}
        {codeInfo && (
          <Animated.View entering={FadeInDown.delay(70).duration(380)}>
            <View style={[s.codeBanner, { backgroundColor: C.primary + '0D', borderColor: C.primary + '30' }]}>
              <View style={[s.codeIconWrap, { backgroundColor: C.primary + '18' }]}>
                <MaterialCommunityIcons name="tag-outline" size={16} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.codeLabel, { color: C.primary }]}>
                  Code: {codeInfo.code.toUpperCase()} — {codeInfo.category}
                </Text>
                <Text style={[s.codeDesc, { color: C.textSecondary }]} numberOfLines={2}>
                  {codeInfo.description}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(100).duration(380)}>
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
            <Text style={[s.cardLabel, { color: C.textTertiary }]}>DESCRIPTION</Text>
            <Text style={[s.cardBody, { color: C.text }]}>{defect.description}</Text>
          </View>
        </Animated.View>

        {/* Asset & Location */}
        {(defect.asset_type || defect.location_on_site) && (
          <Animated.View entering={FadeInDown.delay(130).duration(380)}>
            <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
              <Text style={[s.cardLabel, { color: C.textTertiary }]}>ASSET</Text>
              {defect.asset_type && (
                <View style={s.infoRow}>
                  <MaterialCommunityIcons name="tools" size={15} color={C.textSecondary} />
                  <Text style={[s.infoTxt, { color: C.text }]}>{formatAssetType(defect.asset_type)}</Text>
                </View>
              )}
              {defect.location_on_site && (
                <View style={s.infoRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={15} color={C.textSecondary} />
                  <Text style={[s.infoTxt, { color: C.text }]}>{defect.location_on_site}</Text>
                </View>
              )}
              {defect.serial_number && (
                <View style={s.infoRow}>
                  <MaterialCommunityIcons name="barcode" size={15} color={C.textSecondary} />
                  <Text style={[s.infoTxt, { color: C.textSecondary }]}>S/N: {defect.serial_number}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Photos */}
        {photosArr.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(380)}>
            <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
              <Text style={[s.cardLabel, { color: C.textTertiary }]}>PHOTOS ({photosArr.length})</Text>
              <View style={s.photoGrid}>
                {photosArr.map((uri) => (
                  <TouchableOpacity
                    key={uri}
                    onPress={() => setLightboxUri(uri)}
                    activeOpacity={0.85}
                    style={s.photoThumbWrap}
                  >
                    <Image source={{ uri: getValidLocalUri(uri) }} style={s.photoThumb} resizeMode="cover" />
                    <View style={[s.photoOverlay, { backgroundColor: C.shadow + '26' }]}>
                      <MaterialCommunityIcons name="magnify-plus-outline" size={18} color={C.textOnPrimary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Status info (read-only) */}
        <Animated.View entering={FadeInDown.delay(190).duration(380)}>
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
            <Text style={[s.cardLabel, { color: C.textTertiary }]}>CURRENT STATUS</Text>
            <View style={s.statusReadRow}>
              <View style={[s.statusReadPill, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
                <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[s.statusReadTxt, { color: statusColor }]}>
                  {defect.status.charAt(0).toUpperCase() + defect.status.slice(1)}
                </Text>
              </View>
              <Text style={[s.statusAdminNote, { color: C.textTertiary }]}>
                Status updates managed by admin
              </Text>
            </View>
          </View>
        </Animated.View>

      </ScrollView>

      {/* Bottom action bar — Delete only when job is in_progress */}
      {!jobLocked && (
        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
          <TouchableOpacity
            style={[s.bottomBtn, { backgroundColor: C.error + '12', borderColor: C.error + '30' }]}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="delete-outline" size={18} color={C.error} />
            <Text style={[s.bottomBtnTxt, { color: C.error }]}>Remove Defect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Photo Lightbox */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <View style={[s.lightbox, { backgroundColor: C.shadow + 'EB' }]}>
          <TouchableOpacity style={[s.lightboxClose, { backgroundColor: C.textOnPrimary + '26' }]} onPress={() => setLightboxUri(null)}>
            <MaterialCommunityIcons name="close" size={28} color={C.textOnPrimary} />
          </TouchableOpacity>
          {lightboxUri && (
            <Image source={{ uri: getValidLocalUri(lightboxUri) }} style={s.lightboxImg} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}
```

*Size: **416** lines of code.*

---

## 📄 `app/(app)/jobs/[id]/defects.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function DefectsScreen`
```tsx
export default function DefectsScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = useDefectsStore();
  const [filter, setFilter] = useState<string>('All');
  const sheetRef = useRef<AddDefectSheetRef>(null);

  const [propertyId, setPropertyId] = useState<string>('');
  // F4: Track job status to lock FAB on completed/cancelled jobs
  const [jobStatus, setJobStatus] = useState<string>('');

  useEffect(() => {
    if (jobId) {
      store.loadDefects(jobId);
      const job = getJobById<{ property_id: string; status: string }>(jobId);
      if (job) {
        setPropertyId(job.property_id);
        setJobStatus(job.status);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const filteredDefects = useMemo(() => {
    let list = store.defects;
    if (filter === 'Critical')   list = list.filter(d => d.severity === DefectSeverity.Critical);
    if (filter === 'Major')      list = list.filter(d => d.severity === DefectSeverity.Major);
    if (filter === 'Minor')      list = list.filter(d => d.severity === DefectSeverity.Minor);
    if (filter === 'Open')       list = list.filter(d => d.status === DefectStatus.Open);
    if (filter === 'Quoted')     list = list.filter(d => d.status === DefectStatus.Quoted);
    if (filter === 'Monitoring') list = list.filter(d => d.status === DefectStatus.Monitoring);
    if (filter === 'Resolved')   list = list.filter(d => d.status === DefectStatus.Repaired);
    return list;
  }, [store.defects, filter]);

  if (store.isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="Defects" showBack={true} />
        <View style={{ paddingTop: 24, gap: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  // BUG 30 FIX: added Monitoring + Quoted so all DefectStatus values are filterable
  const filterOpts = ['All', 'Critical', 'Major', 'Minor', 'Open', 'Quoted', 'Monitoring', 'Resolved'];

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        title="Defects"
        showBack={true}
        rightComponent={
          store.defects.length > 0 ? (
            <View style={[s.countBadge, { backgroundColor: C.backgroundTertiary }]}>
              <Text style={[s.countText, { color: C.textSecondary }]}>{store.defects.length} defect{store.defects.length !== 1 ? 's' : ''}</Text>
            </View>
          ) : null
        }
      />

      <View style={s.filterRow}>
        <FilterPills
          options={filterOpts.map(t => ({ label: t }))}
          activeIndex={filterOpts.indexOf(filter)}
          onSelect={(idx) => setFilter(filterOpts[idx])}
          variant="dark"
        />
      </View>

      {/* BUG 15 FIX: check filteredDefects.length so empty state also shows when a filter matches nothing */}
      {filteredDefects.length === 0 ? (
        <EmptyState
          icon={store.defects.length === 0 ? 'check-circle-outline' : 'magnify'}
          title={store.defects.length === 0 ? 'No defects found' : 'No matches'}
          subtitle={
            store.defects.length === 0
              ? 'Great work! No issues were raised for this job.'
              : `No defects match the "${filter}" filter.`
          }
        />
      ) : (
        <FlatList
          data={filteredDefects}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <DefectCard
              defect={item as Defect & { asset_type?: string; location_on_site?: string }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/jobs/${jobId}/defects/${item.id}` as never);
              }}
            />
          )}
        />
      )}

      {/* F4: Only show Add Defect FAB when job is actively in progress.
          Adding defects to a Completed/Cancelled job corrupts the already-generated report. */}
      {jobStatus === 'in_progress' && (
        <TouchableOpacity style={[s.fab, { backgroundColor: C.accent }, cardShadow]} activeOpacity={0.9} onPress={() => sheetRef.current?.open()}>
          <MaterialCommunityIcons name="plus" size={28} color={C.textOnPrimary} />
        </TouchableOpacity>
      )}

      <AddDefectSheet ref={sheetRef} jobId={jobId as string} propertyId={propertyId} onSaved={() => store.loadDefects(jobId as string)} />
    </View>
  );
}
```

*Size: **149** lines of code.*

---

## 📄 `app/(app)/jobs/[id]/index.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function JobDetailScreen`
```tsx
export default function JobDetailScreen() {
  const C = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { updateJobStatus } = useJobsStore();
  const navigation = useNavigation();

  const PRIORITY_COLOR: Record<Priority, string> = {
    [Priority.Urgent]: C.error,
    [Priority.High]:   C.warning,
    [Priority.Normal]: C.primary,
    [Priority.Low]:    C.textTertiary,
  };

  // ── State ─────────────────────────────────────────────────────────────
  const [job,     setJob]     = useState<JobDetail | null>(null);
  const [assets,  setAssets]  = useState<AssetWithResult[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [photos,  setPhotos]  = useState<InspectionPhoto[]>([]);
  const [notes,   setNotes]   = useState('');
  const [isEditingNotes,   setIsEditingNotes]   = useState(false);
  const [isLoading,        setIsLoading]        = useState(true);
  const [hasSig,           setHasSig]           = useState(false);
  const [showBottomSheet,  setShowBottomSheet]  = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionCountdown, setCompletionCountdown] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────
  const loadJob = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const j = getJobById<JobDetail>(id);
      if (!j) { setIsLoading(false); return; }
      setJob(j);
      setNotes(j.notes ?? '');
      setAssets(getAssetsWithJobResults<AssetWithResult>(id, j.property_id));
      setDefects(getDefectsForJob<Defect>(id));
      setPhotos(getPhotosForJob<InspectionPhoto>(id));
      setHasSig(!!getSignatureForJob(id));
    } catch (err) {
      console.error('[JobDetail] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const handleSaveNotes = useCallback(() => {
    if (!job) return;
    const now = new Date().toISOString();
    // Sanitize before persisting — prevents injection patterns from reaching
    // the sync queue payload and eventually the PDF HTML template.
    const sanitized = sanitizeText(notes, MAX_LENGTHS.longNotes);
    setNotes(sanitized);
    updateRecord('jobs', job.id, { status: job.status, notes: sanitized, updated_at: now });
    addToSyncQueue('jobs', job.id, SyncOperation.Update, { notes: sanitized, updated_at: now });
    setIsEditingNotes(false);
    Toast.show({ type: 'success', text1: 'Notes saved' });
  }, [job, notes]);

  useEffect(() => { loadJob(); }, [loadJob]);
  // Refresh data whenever we navigate back to this screen
  useFocusEffect(useCallback(() => { loadJob(); }, [loadJob]));

  // Warn before leaving if there are unsaved notes
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (!isEditingNotes) return; // no unsaved changes
      e.preventDefault();
      Alert.alert(
        'Unsaved Notes',
        'You have unsaved field notes. Save them before leaving?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Save & Leave',
            onPress: () => { handleSaveNotes(); navigation.dispatch(e.data.action); },
          },
        ]
      );
    });
    return unsub;
  }, [navigation, isEditingNotes, handleSaveNotes]);

  // ── Job actions ────────────────────────────────────────────────────────
  const handleStartJob = async () => {
    if (!job || !user) return;
    try {
      updateJobStatus(job.id, JobStatus.InProgress);
      setJob(p => p ? { ...p, status: JobStatus.InProgress } : p);
      Toast.show({ type: 'success', text1: 'Job Started' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to start job' });
    }
  };

  const handleCompleteRequest = () => setShowBottomSheet(true);

  // Last-line-of-defence signature guard.
  const handleFinalizeConfirm = () => {
    setShowBottomSheet(false);
    if (!hasSig) {
      Alert.alert(
        'Signature Required',
        'A client signature is required before completing this job. Please capture a signature first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Signature',
            onPress: () => { if (job) router.push(`/jobs/${job.id}/signature` as never); },
          },
        ]
      );
      return;
    }
    // FIX: block completion if no assets have been inspected at all.
    // A completed job with 0 inspected assets generates a meaningless blank PDF.
    if (inspected === 0) {
      Alert.alert(
        'No Assets Inspected',
        'You must inspect at least one asset before completing this job.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Inspection',
            onPress: () => { if (job) router.push(`/jobs/${job.id}/inspect` as never); },
          },
        ]
      );
      return;
    }
    finalizeCompletion();
  };

  const finalizeCompletion = () => {
    if (!job) return;
    updateJobStatus(job.id, JobStatus.Completed);
    setJob(p => p ? { ...p, status: JobStatus.Completed } : p);
    setShowCompletionModal(true);
    setCompletionCountdown(5);
    countdownRef.current = setInterval(() => {
      setCompletionCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setShowCompletionModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleContinueWorking = () => {
    if (!job) return;
    Alert.alert(
      'Continue Working?',
      'This will re-open the job and unlock the inspection form. All existing data is preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue Working',
          onPress: () => {
            const now = new Date().toISOString();
            updateRecord('jobs', job.id, { status: JobStatus.InProgress, report_url: null, updated_at: now });
            addToSyncQueue('jobs', job.id, SyncOperation.Update, {
              status: JobStatus.InProgress,
              report_url: null,
              updated_at: now,
            });
            updateJobStatus(job.id, JobStatus.InProgress);
            setJob(p => p ? { ...p, status: JobStatus.InProgress, report_url: null } : p);
            Toast.show({
              type: 'success',
              text1: 'Job re-opened',
              text2: 'Changes will sync to the server automatically',
            });
          },
        },
      ]
    );
  };

  const handleNavigate = () => {
    if (!job) return;
    const addr = [job.property_address, job.property_suburb, job.property_state].filter(Boolean).join(', ');
    if (!addr.trim()) {
      Toast.show({ type: 'info', text1: 'No address on file', text2: 'Contact your manager to update this property.' });
      return;
    }
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(addr)}`);
  };

  const totalAssets = assets.length;
  const passedCount = assets.filter(a => a.result === InspectionResult.Pass).length;
  const failedCount = assets.filter(a => a.result === InspectionResult.Fail).length;
  const inspected   = passedCount + failedCount;
  const progressPct = totalAssets > 0 ? Math.round((inspected / totalAssets) * 100) : 0;
  
  const passedPct = totalAssets > 0 ? (passedCount / totalAssets) * 100 : 0;
  const failedPct = totalAssets > 0 ? (failedCount / totalAssets) * 100 : 0;

  // ── Loading / error states ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }
  if (!job) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <MaterialCommunityIcons name="file-search-outline" size={48} color={C.textTertiary} />
        <Text style={[s.notFound, { color: C.textSecondary }]}>Job not found</Text>
        <View style={{ marginTop: 16 }}>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const isInProgress = job.status === JobStatus.InProgress;
  const isCompleted  = job.status === JobStatus.Completed;
  const isCancelled  = job.status === JobStatus.Cancelled;
  const isScheduled  = job.status === JobStatus.Scheduled;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      {/* ── HEADER — outside ScrollView so it never overlaps the status bar ── */}
      <ScreenHeader
        eyebrow={`Job #${job.id.substring(0, 8).toUpperCase()}`}
        title={job.property_name || 'Job Details'}
        subtitle={[job.property_address, job.property_suburb].filter(Boolean).join(', ') || 'No address on record'}
        showBack={true}
        rightComponent={
          <Badge
            status={job.status}
            label={
              isInProgress ? 'In Progress'
              : isCompleted ? 'Completed'
              : isCancelled ? 'Cancelled'
              : 'Scheduled'
            }
          />
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <View style={s.body}>

          {/* ── JOB ACTIONS WIDGET ── */}
          {!isCompleted && !isCancelled && (
            <Animated.View entering={FadeInDown.delay(40).duration(360)}>
              {isInProgress ? (
                <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.timerLabel, { color: C.text }]}>Job In Progress</Text>
                    <Text style={[s.timerSub, { color: C.textSecondary }]}>You can now perform inspections.</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleCompleteRequest}
                    style={[s.continueBtn, { backgroundColor: C.primary, borderColor: C.primary, paddingHorizontal: 16, paddingVertical: 10 }]}
                  >
                    <Text style={[s.continueBtnTxt, { color: C.textOnPrimary }]}>Complete Job</Text>
                  </TouchableOpacity>
                </Card>
              ) : (
                <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.timerLabel, { color: C.text }]}>Job Scheduled</Text>
                    <Text style={[s.timerSub, { color: C.textSecondary }]}>Start the job to begin work.</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleStartJob}
                    style={[s.continueBtn, { backgroundColor: C.primary, borderColor: C.primary, paddingHorizontal: 20, paddingVertical: 10 }]}
                  >
                    <Text style={[s.continueBtnTxt, { color: C.textOnPrimary }]}>Start Job</Text>
                  </TouchableOpacity>
                </Card>
              )}
            </Animated.View>
          )}

          {/* Completed banner */}
          {isCompleted && (
            <Card variant="success" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MaterialCommunityIcons name="check-decagram" size={22} color={C.success} />
              <View style={{ flex: 1 }}>
                <Text style={[s.statusBannerTitle, { color: C.success }]}>Job Completed</Text>
                {hasSig && (
                  <Text style={[s.statusBannerSub, { color: C.success }]}>Client signature captured</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={handleContinueWorking}
                style={[s.continueBtn, { backgroundColor: C.success + '18', borderColor: C.success }]}
              >
                <MaterialCommunityIcons name="pencil-outline" size={14} color={C.success} />
                <Text style={[s.continueBtnTxt, { color: C.success }]}>Continue</Text>
              </TouchableOpacity>
            </Card>
          )}

          {/* Cancelled banner */}
          {isCancelled && (
            <Card variant="default" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MaterialCommunityIcons name="cancel" size={22} color={C.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.statusBannerTitle, { color: C.textSecondary }]}>Job Cancelled</Text>
                <Text style={[s.statusBannerSub, { color: C.textTertiary }]}>
                  Contact your manager for details.
                </Text>
              </View>
            </Card>
          )}

          {/* ── SAFETY ALERTS ── */}
          {(job.hazard_notes || job.access_notes || job.site_note) && (
            <Animated.View entering={FadeInDown.delay(60).duration(360)} style={{ gap: 8 }}>
              {job.hazard_notes && (
                <Card variant="danger" style={{ flexDirection: 'row', gap: 12 }}>
                  <MaterialCommunityIcons name="alert" size={20} color={C.error} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: C.error }]}>Site Hazard</Text>
                    <Text style={[s.alertBody, { color: C.text }]}>{job.hazard_notes}</Text>
                  </View>
                </Card>
              )}
              {job.access_notes && (
                <Card variant="info" style={{ flexDirection: 'row', gap: 12 }}>
                  <MaterialCommunityIcons name="key" size={20} color={C.info} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: C.info }]}>Access Notes</Text>
                    <Text style={[s.alertBody, { color: C.text }]}>{job.access_notes}</Text>
                  </View>
                </Card>
              )}
              {job.site_note && (
                <Card variant="info" style={{ flexDirection: 'row', gap: 12 }}>
                  <MaterialCommunityIcons name="note-text-outline" size={20} color={C.info} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: C.info }]}>Site Note</Text>
                    <Text style={[s.alertBody, { color: C.text }]}>{job.site_note}</Text>
                  </View>
                </Card>
              )}
            </Animated.View>
          )}

          {/* ── INFO CHIPS ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(360)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
              <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                <MaterialCommunityIcons name="calendar" size={15} color={C.textSecondary} />
                <Text style={[s.chipTxt, { color: C.text }]}>Sch: {fmtDate(job.scheduled_date)}</Text>
              </View>
              {(isCompleted || isInProgress) && job.updated_at && (
                <View style={[s.chip, { backgroundColor: isCompleted ? C.success + '18' : C.primary + '18' }]}>
                  <MaterialCommunityIcons name={isCompleted ? "check-circle-outline" : "play-circle-outline"} size={15} color={isCompleted ? C.success : C.primary} />
                  <Text style={[s.chipTxt, { color: isCompleted ? C.success : C.primary, fontWeight: '700' }]}>
                    {isCompleted ? 'Done: ' : 'Started: '}{fmtDate(job.updated_at.substring(0, 10))}
                  </Text>
                </View>
              )}
              {job.scheduled_time && (
                <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                  <MaterialCommunityIcons name="clock-outline" size={15} color={C.textSecondary} />
                  <Text style={[s.chipTxt, { color: C.text }]}>{fmtTime(job.scheduled_time)}</Text>
                </View>
              )}
              <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                <MaterialCommunityIcons name="wrench-outline" size={15} color={C.textSecondary} />
                <Text style={[s.chipTxt, { color: C.text }]}>
                  {JOB_TYPE_LABEL[job.job_type as JobType] ?? job.job_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Text>
              </View>
              <View style={[s.chip, { backgroundColor: (PRIORITY_COLOR[job.priority] ?? C.accent) + '18' }]}>
                <MaterialCommunityIcons name="lightning-bolt" size={15} color={PRIORITY_COLOR[job.priority] ?? C.accent} />
                <Text style={[s.chipTxt, { color: PRIORITY_COLOR[job.priority] ?? C.accent, fontWeight: '800' }]}>
                  {PRIORITY_LABEL[job.priority] ?? job.priority}
                </Text>
              </View>
            </ScrollView>
          </Animated.View>

          {/* ── INSPECTION PROGRESS ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(360)}>
            <Card variant="default">
              <View style={s.progressHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.progressTitle, { color: C.text }]}>Inspection Progress</Text>
                  <Text style={[s.progressSubtitle, { color: C.textSecondary }]}>
                    {totalAssets === 0
                      ? 'No assets registered for this property'
                      : `${inspected} of ${totalAssets} assets inspected`}
                  </Text>
                </View>
                <Text style={[s.progressPct, { color: progressPct === 100 ? (failedCount > 0 ? C.error : C.success) : C.textSecondary }]}>
                  {progressPct}%
                </Text>
              </View>
              <View style={[s.progressTrack, { backgroundColor: C.backgroundTertiary, flexDirection: 'row' }]}>
                {passedPct > 0 && <View style={[s.progressFill, { width: `${passedPct}%`, backgroundColor: C.success }]} />}
                {failedPct > 0 && <View style={[s.progressFill, { width: `${failedPct}%`, backgroundColor: C.error }]} />}
              </View>
              {totalAssets > 0 && (
                <View style={s.progressStatRow}>
                  {[
                    { label: 'Passed',  count: assets.filter(a => a.result === InspectionResult.Pass).length,  color: C.success },
                    { label: 'Failed',  count: assets.filter(a => a.result === InspectionResult.Fail).length,  color: C.error },
                    { label: 'Pending', count: assets.filter(a => !a.result).length, color: C.textTertiary },
                  ].map(stat => (
                    <View key={stat.label} style={s.progressStat}>
                      <View style={[s.progressStatDot, { backgroundColor: stat.color }]} />
                      <Text style={[s.progressStatTxt, { color: C.textSecondary }]}>
                        {stat.count} {stat.label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </Animated.View>

          {/* ── OPEN INSPECTION FORM CTA ── */}
          <Animated.View entering={FadeInDown.delay(120).duration(360)}>
            <TouchableOpacity
              style={{ borderRadius: 16, overflow: 'hidden' }}
              onPress={
                isInProgress ? () => router.push(`/jobs/${id}/inspect` as never)
                : isCompleted ? handleContinueWorking
                : undefined
              }
              activeOpacity={0.88}
              disabled={isScheduled || isCancelled}
            >
              {isInProgress ? (
                <Card
                  variant="success"
                  style={s.inspectCta}
                >
                  <View style={[s.inspectCtaIcon, { backgroundColor: C.success + '20' }]}>
                    <MaterialCommunityIcons name="clipboard-check" size={26} color={C.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.inspectCtaTitle, { color: C.success }]}>
                      Open inspection form
                    </Text>
                    <Text style={[s.inspectCtaSub, { color: C.success, opacity: 0.85 }]}>
                      {totalAssets === 0
                        ? 'Add assets and begin the on-site inspection'
                        : progressPct === 100
                        ? 'All assets inspected'
                        : `${totalAssets - inspected} asset${totalAssets - inspected !== 1 ? 's' : ''} remaining`}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={24} color={C.success} />
                </Card>
              ) : (
                <Card variant="default" style={[s.inspectCta, { opacity: isCompleted ? 1 : 0.7 }]}>
                  <View style={[s.inspectCtaIcon, { backgroundColor: isCompleted ? C.warning + '18' : C.backgroundTertiary }]}>
                    <MaterialCommunityIcons name={isCompleted ? "lock-open-outline" : "clipboard-check-outline"} size={26} color={isCompleted ? C.warningDark : C.textTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.inspectCtaTitle, { color: C.text }]}>
                      {isCompleted ? 'Re-open inspection' : 'Open inspection form'}
                    </Text>
                    <Text style={[s.inspectCtaSub, { color: isCompleted ? C.warningDark : C.textSecondary }]}>
                      {isScheduled
                        ? 'Start job first to begin the inspection'
                        : isCancelled
                        ? 'This job has been cancelled'
                        : 'Tap here to unlock and edit the form'}
                    </Text>
                  </View>
                  {isCompleted && (
                     <MaterialCommunityIcons name="chevron-right" size={24} color={C.warningDark} />
                  )}
                </Card>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* ── QUICK ACTIONS GRID ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>Quick actions</Text>
            <View style={s.actionsRow}>
              <ActionCard
                icon="alert-circle-outline"
                title="Defects"
                subtitle={defects.length === 0 ? 'None logged' : `${defects.length} defect${defects.length !== 1 ? 's' : ''}`}
                badge={defects.length}
                badgeColor={C.error}
                onPress={() => router.push(`/jobs/${id}/defects` as never)}
                C={C}
              />
              <ActionCard
                icon="camera-outline"
                title="Photos"
                subtitle={photos.length === 0 ? 'None captured' : `${photos.length} photo${photos.length !== 1 ? 's' : ''}`}
                badge={photos.length}
                badgeColor={C.accent}
                onPress={() => router.push(`/jobs/${id}/photos` as never)}
                C={C}
              />
            </View>
            <View style={[s.actionsRow, { marginTop: 12 }]}>
              <ActionCard
                icon="file-document-outline"
                title="Quote"
                subtitle="Parts & labour"
                onPress={() => router.push(`/jobs/${id}/quote` as never)}
                C={C}
              />
              <ActionCard
                icon="draw"
                title="Signature"
                subtitle={hasSig ? 'Captured' : 'Required for report'}
                onPress={() => router.push(`/jobs/${id}/signature` as never)}
                C={C}
              />
            </View>
          </Animated.View>

          {/* ── NAVIGATE & CONTACT ── */}
          <Animated.View entering={FadeInDown.delay(160).duration(360)} style={{ gap: 12 }}>
            <TouchableOpacity
              style={[s.quickBtn, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={handleNavigate}
              activeOpacity={0.8}
            >
              <View style={[s.quickBtnIcon, { backgroundColor: C.info + '18' }]}>
                <MaterialCommunityIcons name="map-marker-path" size={22} color={C.infoDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.quickBtnTitle, { color: C.text }]}>Navigate to Site</Text>
                {[job.property_address, job.property_suburb].filter(Boolean).length > 0 && (
                  <Text style={[s.quickBtnSub, { color: C.textSecondary }]} numberOfLines={1}>
                    {[job.property_address, job.property_suburb].filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={C.borderStrong} />
            </TouchableOpacity>

            {job.site_contact_phone && (
              <TouchableOpacity
                style={[s.quickBtn, { backgroundColor: C.surface, borderColor: C.border }]}
                onPress={() => Linking.openURL(`tel:${job.site_contact_phone}`)}
                activeOpacity={0.8}
              >
                <View style={[s.quickBtnIcon, { backgroundColor: C.success + '18' }]}>
                  <MaterialCommunityIcons name="phone-in-talk" size={22} color={C.successDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.quickBtnTitle, { color: C.text }]}>
                    {job.site_contact_name || 'Call Site Contact'}
                  </Text>
                  <Text style={[s.quickBtnSub, { color: C.textSecondary }]}>{job.site_contact_phone}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={C.borderStrong} />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* ── FIELD NOTES ── */}
          <Animated.View entering={FadeInDown.delay(180).duration(360)}>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>Field notes</Text>
            <Card variant="default">
              {isEditingNotes ? (
                <>
                  <TextInput
                    style={[s.notesInput, { color: C.text, borderColor: C.border, backgroundColor: C.backgroundTertiary }]}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    maxLength={MAX_LENGTHS.longNotes}
                    placeholder="Document site conditions, access details, or follow-up actions…"
                    placeholderTextColor={C.textTertiary}
                    textAlignVertical="top"
                    autoCorrect={false}
                  />
                  <View style={s.notesActionRow}>
                    <TouchableOpacity
                      style={[s.notesCancelBtn, { borderColor: C.border }]}
                      onPress={() => { setNotes(job.notes ?? ''); setIsEditingNotes(false); }}
                    >
                      <Text style={[s.notesCancelTxt, { color: C.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.notesSaveBtn, { backgroundColor: C.accent }]}
                      onPress={handleSaveNotes}
                    >
                      <Text style={[s.notesSaveTxt, { color: C.textOnPrimary }]}>Save Notes</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[notes ? s.notesText : s.notesEmpty, { color: notes ? C.text : C.textTertiary }]}>
                    {notes || 'No notes yet. Tap edit to document site conditions or follow-up actions.'}
                  </Text>
                  <TouchableOpacity
                    style={[s.notesEditBtn, { borderColor: C.border }]}
                    onPress={() => setIsEditingNotes(true)}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={C.accent} />
                    <Text style={[s.notesEditTxt, { color: C.accent }]}>
                      {notes ? 'Edit Notes' : 'Add Notes'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Card>
          </Animated.View>

        </View>
      </ScrollView>

      {/* ── BOTTOM ACTION BAR ── */}
      <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border, borderTopWidth: 1, shadowColor: C.shadow }]}>
        <Button
          title={
            isCompleted && job?.report_url ? 'View Report' :
            isCompleted                    ? 'Generate Report' :
            isInProgress                   ? 'Draft Preview' :
            'Report Not Available'
          }
          variant={isCompleted ? 'secondary' : 'primary'}
          disabled={isScheduled || isCancelled}
          onPress={() => {
            if (isCompleted && job?.report_url) {
              router.push(`/jobs/${id}/report` as never);
            } else if (isCompleted || isInProgress) {
              router.push(`/jobs/${id}/preview` as never);
            }
          }}
          icon={
            <MaterialCommunityIcons
              name={isCompleted && job?.report_url ? 'file-check-outline' : isCompleted ? 'file-chart-outline' : 'file-eye-outline'}
              size={20}
              color={(isScheduled || isCancelled) ? C.textTertiary : C.textOnPrimary}
            />
          }
          style={{ height: 52, borderRadius: 26 }}
        />
      </View>


      <CompletionBottomSheet
        visible={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        onConfirm={handleFinalizeConfirm}
        onNeedSignature={() => {
          setShowBottomSheet(false);
          if (job) router.push(`/jobs/${job.id}/signature` as never);
        }}
        assetsTotal={totalAssets}
        assetsInspected={inspected}
        hasSignature={hasSig}
        hasDefects={defects.length > 0}
      />

      {/* Job completion celebration modal */}
      <Modal
        visible={showCompletionModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setShowCompletionModal(false);
        }}
      >
        <View style={[cm.overlay, { backgroundColor: C.shadow + 'D9' }]}>
          <View style={[cm.card, { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, shadowColor: C.shadow }]}>
            <View style={[cm.checkCircle, { backgroundColor: C.success + '18' }]}>
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <MaterialCommunityIcons name="check-bold" size={44} color={C.success} />
              </Animated.View>
            </View>
            <Text style={[cm.title, { color: C.text }]}>Job Complete!</Text>
            <Text style={[cm.property, { color: C.textSecondary }]}>{job?.property_name ?? 'Property'}</Text>

            <View style={[cm.statsRow, { backgroundColor: C.backgroundTertiary, borderColor: C.border, borderWidth: 1 }]}>
              <View style={cm.statItem}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={C.textTertiary} style={cm.statIcon} />
                <Text style={[cm.statValue, { color: C.text }]}>{assets.filter(a => a.result !== null).length}/{assets.length}</Text>
                <Text style={[cm.statLabel, { color: C.textTertiary }]}>Inspected</Text>
              </View>
              <View style={[cm.statDivider, { backgroundColor: C.border }]} />
              <View style={cm.statItem}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={C.textTertiary} style={cm.statIcon} />
                <Text style={[cm.statValue, { color: C.text }]}>{defects.length}</Text>
                <Text style={[cm.statLabel, { color: C.textTertiary }]}>Defects</Text>
              </View>
              <View style={[cm.statDivider, { backgroundColor: C.border }]} />
              <View style={cm.statItem}>
                <MaterialCommunityIcons name="draw" size={20} color={C.textTertiary} style={cm.statIcon} />
                <Text style={[cm.statValue, { color: C.text }]}>{hasSig ? 'Yes' : 'No'}</Text>
                <Text style={[cm.statLabel, { color: C.textTertiary }]}>Signed</Text>
              </View>
            </View>

            <Text style={[cm.autoCloseTxt, { color: C.textSecondary }]}>
              Returning to dashboard in {completionCountdown}s…
            </Text>

            <TouchableOpacity
              style={[cm.btn, { backgroundColor: C.primary }]}
              onPress={() => {
                if (countdownRef.current) clearInterval(countdownRef.current);
                setShowCompletionModal(false);
              }}
            >
              <Text style={[cm.btnTxt, { color: C.textOnPrimary }]}>Close Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}
```

*Size: **934** lines of code.*

---

## 📄 `app/(app)/jobs/[id]/inspect.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function AssetInspectionScreen`
```tsx
export default function AssetInspectionScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = useInspectionStore();

  const [filter, setFilter] = useState<string>('All');
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetWithResult | null>(null);
  const [propertyId, setPropertyId]  = useState<string>('');
  const [jobTitle, setJobTitle]    = useState<string>('');
  const [jobDate, setJobDate]     = useState<string>('');

  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (jobId) {
      const job = getJobById<{ property_id: string; property_name: string | null; scheduled_date: string }>(jobId);
      if (job) {
        setPropertyId(job.property_id);
        setJobTitle(job.property_name ?? '');
        setJobDate(job.scheduled_date ?? '');
      }
    }
  }, [jobId]);

  const allDone = store.progress.total > 0 && store.progress.inspected === store.progress.total;
  const hasActualResults = store.assets.some(a => a.result === InspectionResult.Pass || a.result === InspectionResult.Fail);

  // Single-pass reduce instead of 4 separate .filter() calls — O(n) vs O(4n)
  const counts = useMemo(() => {
    const acc = { passed: 0, failed: 0, nt: 0, remaining: 0 };
    for (const a of store.assets) {
      if      (a.result === InspectionResult.Pass)      acc.passed++;
      else if (a.result === InspectionResult.Fail)      acc.failed++;
      else if (a.result === InspectionResult.NotTested) acc.nt++;
      else                                              acc.remaining++;
    }
    return acc;
  }, [store.assets]);

  useEffect(() => {
    if (jobId) store.loadAssetsForInspection(jobId);
    return () => store.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const filteredAssets = useMemo(() => {
    switch (filter) {
      case 'Passed':    return store.assets.filter(a => a.result === InspectionResult.Pass);
      case 'Failed':    return store.assets.filter(a => a.result === InspectionResult.Fail);
      case 'N/T':       return store.assets.filter(a => a.result === InspectionResult.NotTested);
      case 'Remaining': return store.assets.filter(a => a.result === null);
      default:          return store.assets;
    }
  }, [store.assets, filter]);

  // Decision #2: mark all uninspected assets as not_tested before completing.
  // This runs synchronously before navigation — the store's updateAssetResult
  // writes to SQLite + queues sync for each asset.
  const markUninspectedAsNotTested = useCallback(() => {
    for (const asset of store.assets) {
      if (asset.result === null) {
        store.updateAssetResult(asset.id, InspectionResult.NotTested);
      }
    }
  }, [store]);

  const handleComplete = () => {
    if (!store.isInspectionComplete()) {
      Alert.alert(
        'Incomplete Inspection',
        `${store.progress.total - store.progress.inspected} asset${
          store.progress.total - store.progress.inspected !== 1 ? 's have' : ' has'
        } not been inspected.\n\nUninspected assets will be automatically marked as Not Tested.\n\nComplete anyway?`,
        [
          { text: 'Continue Inspecting', style: 'cancel' },
          {
            text: 'Complete Anyway',
            onPress: () => {
              markUninspectedAsNotTested();
              router.replace(`/jobs/${jobId}/report` as never);
            },
          },
        ]
      );
    } else {
      router.replace(`/jobs/${jobId}/report` as never);
    }
  };

  const handleClone = useCallback((assetToClone: AssetWithResult) => {
    try {
      const newId = generateUUID();
      const now = new Date().toISOString();
      // FIX: Add company_id to the cloned payload so the sync queue INSERT
      // passes Supabase RLS (all asset rows must belong to a company).
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const payload = {
        id: newId,
        property_id: assetToClone.property_id,
        company_id: companyId,
        asset_type: assetToClone.asset_type,
        variant: assetToClone.variant,
        asset_ref: null,
        description: assetToClone.description,
        location_on_site: assetToClone.location_on_site,
        serial_number: null,
        barcode_id: null,
        install_date: assetToClone.install_date,
        last_service_date: null,
        next_service_date: null,
        status: AssetStatus.Active,
        created_at: now,
      };

      upsertRecord('assets', payload);
      addToSyncQueue('assets', newId, SyncOperation.Insert, payload);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Asset cloned' });
      
      if (jobId) store.loadAssetsForInspection(jobId);
    } catch (err) {
      console.error('Failed to clone asset:', err);
      Toast.show({ type: 'error', text1: 'Failed to clone asset' });
    }
  }, [jobId, store]);

  const handleDelete = useCallback((assetToDelete: AssetWithResult) => {
    Alert.alert(
      'Delete Asset',
      `Are you sure you want to delete this ${formatAssetType(assetToDelete.asset_type)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              // BUG-N5 FIX: Clean up ALL related rows before soft-deleting the asset.
              // Without this, the deleted asset's inspection result + photos still appear
              // in getAssetsWithJobResults (LEFT JOIN on job_assets) and in the PDF.

              // 1. Cancel/delete all inspection_photos for this asset in this job
              if (jobId) {
                const assetPhotos = queryRecords<{ id: string; photo_url: string }>(
                  'inspection_photos', { job_id: jobId, asset_id: assetToDelete.id }
                );
                for (const p of assetPhotos) {
                  deleteRecord('inspection_photos', p.id);
                  recordDeletedPhoto(p.id);
                  if (p.photo_url.startsWith('https://')) {
                    addToSyncQueue('inspection_photos', p.id, SyncOperation.Delete, {
                      id: p.id, photo_url: p.photo_url,
                    });
                  } else {
                    cancelPendingPhotoUpload(p.id);
                  }
                }

                // 2. Delete the job_asset (inspection result) row for this asset
                const jobAssetRows = queryRecords<{ id: string }>(
                  'job_assets', { job_id: jobId, asset_id: assetToDelete.id }
                );
                for (const ja of jobAssetRows) {
                  deleteRecord('job_assets', ja.id);
                  addToSyncQueue('job_assets', ja.id, SyncOperation.Delete, { id: ja.id });
                }
              }

              // 3. Soft-delete the asset by setting status = decommissioned
              const payload = { status: AssetStatus.Decommissioned };
              updateRecord('assets', assetToDelete.id, payload);
              addToSyncQueue('assets', assetToDelete.id, SyncOperation.Update, payload);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Toast.show({ type: 'success', text1: 'Asset deleted' });

              if (jobId) store.loadAssetsForInspection(jobId);
            } catch (err) {
              console.error('Failed to delete asset:', err);
              Toast.show({ type: 'error', text1: 'Failed to delete asset' });
            }
          }
        }
      ]
    );
  }, [jobId, store]);

  const renderItem = useCallback(({ item, index }: { item: AssetWithResult; index: number }) => (
    <AssetCard asset={item} index={index} jobId={jobId as string} onEdit={setEditingAsset} onClone={handleClone} onDelete={handleDelete} />
  ), [jobId, handleClone, handleDelete]);

  const fillPct = store.progress.total > 0 ? (store.progress.inspected / store.progress.total) * 100 : 0;

  if (store.isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="Asset Inspection" showBack={true} />
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonBlock width="100%" height={160} borderRadius={16} />
          <SkeletonBlock width="100%" height={160} borderRadius={16} />
          <SkeletonBlock width="100%" height={160} borderRadius={16} />
        </View>
      </View>
    );
  }

  if (store.error) {
    return (
      <View style={[s.screen, { backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="alert" size={40} color={C.error} />
        <Text style={{ marginTop: 10, color: C.error, textAlign: 'center', paddingHorizontal: 32 }}>{store.error}</Text>
        <View style={{ marginTop: 16 }}><Button title="Go Back" onPress={() => router.back()} /></View>
      </View>
    );
  }

  const filterOptions = [
    { label: 'All',       count: store.assets.length },
    { label: 'Remaining', count: counts.remaining },
    { label: 'Passed',    count: counts.passed },
    { label: 'Failed',    count: counts.failed },
    { label: 'N/T',       count: counts.nt },
  ];

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="FIRE SAFETY COMPLIANCE"
        title="Inspection Form"
        showBack={true}
        rightComponent={
          <View style={[s.progressBadge, { backgroundColor: allDone ? C.successLight : C.backgroundTertiary, borderColor: allDone ? C.success : C.border, borderWidth: 1 }]}>
            <Text style={[s.progressBadgeTxt, { color: allDone ? C.success : C.textSecondary }]}>
              {allDone ? 'All Done ' : ''}{store.progress.inspected}/{store.progress.total}
            </Text>
          </View>
        }
      />

      <FlatList
        ref={listRef}
        data={filteredAssets}
        keyExtractor={i => i.id}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={8}
        ListHeaderComponent={
          <View>
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <View style={[s.overviewCard, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
                {Boolean(jobTitle || jobDate) && (
                  <View style={[s.formInfoBar, { borderBottomColor: C.border }]}>
                    <View style={s.formInfoItem}>
                      <Text style={[s.formInfoLabel, { color: C.textTertiary }]}>PROPERTY</Text>
                      <Text style={[s.formInfoValue, { color: C.text }]} numberOfLines={1}>{jobTitle || '—'}</Text>
                    </View>
                    <View style={[s.formInfoDivider, { backgroundColor: C.border }]} />
                    <View style={s.formInfoItem}>
                      <Text style={[s.formInfoLabel, { color: C.textTertiary }]}>DATE</Text>
                      <Text style={[s.formInfoValue, { color: C.text }]}>
                        {jobDate ? new Date(jobDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={[s.progressTrack, { backgroundColor: C.backgroundTertiary }]}>
                  <Animated.View style={[s.progressFill, { backgroundColor: allDone ? C.success : C.primary, width: `${fillPct}%` as `${number}%` }]} />
                </View>
                {store.assets.length > 0 && (
                  <View style={s.summaryBar}>
                    <View style={s.summaryItem}><View style={[s.summaryDot, { backgroundColor: C.success }]} /><Text style={[s.summaryCount, { color: C.success }]}>{counts.passed}</Text><Text style={[s.summaryLabel, { color: C.textTertiary }]}>Passed</Text></View>
                    <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
                    <View style={s.summaryItem}><View style={[s.summaryDot, { backgroundColor: C.error }]} /><Text style={[s.summaryCount, { color: C.error }]}>{counts.failed}</Text><Text style={[s.summaryLabel, { color: C.textTertiary }]}>Failed</Text></View>
                    <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
                    <View style={s.summaryItem}><View style={[s.summaryDot, { backgroundColor: C.textTertiary }]} /><Text style={[s.summaryCount, { color: C.textTertiary }]}>{counts.nt}</Text><Text style={[s.summaryLabel, { color: C.textTertiary }]}>N/T</Text></View>
                    <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
                    <View style={s.summaryItem}><View style={[s.summaryDot, { backgroundColor: C.primary }]} /><Text style={[s.summaryCount, { color: C.primary }]}>{counts.remaining}</Text><Text style={[s.summaryLabel, { color: C.textTertiary }]}>Remaining</Text></View>
                  </View>
                )}
              </View>
            </View>
            <View style={s.filterWrap}>
              <FilterPills options={filterOptions} activeIndex={filterOptions.findIndex(o => o.label === filter)} onSelect={(idx) => setFilter(filterOptions[idx].label)} variant="dark" />
            </View>
          </View>
        }
        ListEmptyComponent={
          store.assets.length === 0 ? (
            <View style={s.emptyState}>
              <View style={[s.emptyIconWrap, { backgroundColor: C.backgroundTertiary }]}><MaterialCommunityIcons name="shield-search" size={40} color={C.textTertiary} /></View>
              <Text style={[s.emptyTitle, { color: C.text }]}>No Assets Registered</Text>
              <Text style={[s.emptySub, { color: C.textSecondary }]}>No fire safety assets are on record for this property.</Text>
              <View style={{ marginTop: 24, width: '100%', paddingHorizontal: 32, gap: 12 }}>
                <Button title="Add Asset On-Site" icon="plus" onPress={() => setShowAddAsset(true)} style={{ borderRadius: 14 }} />
                <Button variant="secondary" title="Go Back" onPress={() => router.back()} />
              </View>
            </View>
          ) : (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="check-circle-outline" size={40} color={C.success} />
              <Text style={[s.emptyTitle, { color: C.text }]}>All Clear</Text>
              <Text style={[s.emptySub, { color: C.textSecondary }]}>No assets match this filter.</Text>
            </View>
          )
        }
        renderItem={renderItem}
      />

      {store.assets.length > 0 && (
        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border, shadowColor: C.shadow }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.bottomBarTitle, { color: C.text }]}>{allDone ? (hasActualResults ? 'All assets inspected' : 'All assets marked (N/T)') : `${counts.remaining} remaining`}</Text>
            <Text style={[s.bottomBarSub, { color: C.textSecondary }]}>{store.progress.inspected} of {store.progress.total} inspected</Text>
          </View>
          <Button title={allDone ? 'Complete' : 'Complete Inspection'} disabled={store.progress.inspected === 0} onPress={handleComplete} style={{ minWidth: 140, borderRadius: 22, height: 46 }} />
        </View>
      )}

      {store.assets.length > 0 && (
        <TouchableOpacity style={[s.addAssetFab, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]} onPress={() => setShowAddAsset(true)} activeOpacity={0.85}>
          <MaterialCommunityIcons name="plus" size={18} color={C.primary} />
          <Text style={[s.addAssetFabTxt, { color: C.primary }]}>Add Asset</Text>
        </TouchableOpacity>
      )}

      <AddAssetModal
        visible={showAddAsset}
        propertyId={propertyId}
        onClose={() => setShowAddAsset(false)}
        onAssetAdded={(newAssets: Asset[]) => {
          setShowAddAsset(false);
          if (jobId) store.loadAssetsForInspection(jobId);
          Toast.show({ type: 'success', text1: 'Asset added', text2: `${newAssets.length} asset(s) registered.` });
        }}
      />
      <EditAssetModal
        visible={!!editingAsset}
        asset={editingAsset}
        onClose={() => setEditingAsset(null)}
        onAssetEdited={() => {
          setEditingAsset(null);
          if (jobId) store.loadAssetsForInspection(jobId);
        }}
      />
    </View>
  );
}
```

*Size: **648** lines of code.*

---

## 📄 `app/(app)/jobs/[id]/photos.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function PhotosScreen`
```tsx
export default function PhotosScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = usePhotosStore();
  const sheetRef = useRef<PhotoCaptureSheetRef>(null);

  const [propertyId, setPropertyId] = useState<string>('');
  // F8: Track job status to lock the add-photo FAB on completed jobs
  const [jobStatus, setJobStatus] = useState<string>('');

  useEffect(() => {
    if (jobId) {
      // BUG 26 FIX: reset store state before loading so previous job's photos don't flash
      store.loadPhotos(jobId);
      const job = getJobById<{ property_id: string; status: string }>(jobId);
      if (job) {
        setPropertyId(job.property_id);
        setJobStatus(job.status);
      }
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
        <ScreenHeader title="Job Photos" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </View>
    );
  }

  if (store.error) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="Job Photos" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 }}>
          <MaterialCommunityIcons name="cloud-alert-outline" size={40} color={C.error} />
          <Text style={{ color: C.error, textAlign: 'center', fontSize: 14, lineHeight: 21 }}>
            {store.error}
          </Text>
          <Button title="Retry" onPress={() => store.loadPhotos(jobId as string)} />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader 
        title="Job Photos" 
        showBack={true} 
        rightComponent={
          store.photos.length > 0 ? (
            <View style={[s.countBadge, { backgroundColor: C.backgroundTertiary }]}>
              <Text style={[s.countText, { color: C.textSecondary }]}>{store.photos.length} photo{store.photos.length !== 1 ? 's' : ''}</Text>
            </View>
          ) : null
        } 
      />

      <PhotoGrid photos={store.photos} onPhotoLongPress={handlePhotoLongPress} />

      {/* F8: Hide FAB on completed jobs — the PDF is already generated/uploaded.
          Adding photos afterwards creates a silent data gap in the submitted report. */}
      {jobStatus !== 'completed' && (
        <TouchableOpacity style={[s.fab, { backgroundColor: C.accent }, cardShadow]} activeOpacity={0.9} onPress={() => sheetRef.current?.open()}>
          <MaterialCommunityIcons name="camera" size={28} color={C.textOnPrimary} />
        </TouchableOpacity>
      )}

      <PhotoCaptureSheet ref={sheetRef} jobId={jobId as string} propertyId={propertyId} />
    </View>
  );
}
```

*Size: **128** lines of code.*

---

## 📄 `app/(app)/jobs/[id]/preview.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function PreviewScreen`
```tsx
export default function PreviewScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const { updateJobStatus } = useJobsStore();

  const [isGenerating, setIsGenerating] = useState(true);
  const [stage, setStage]               = useState<ReportStage>('fetching_data');
  const [stageDetail, setStageDetail]   = useState<string | undefined>();
  const [htmlContent, setHtmlContent]   = useState<string | null>(null);
  const [pdfUri, setPdfUri]             = useState<string | null>(null);
  const [pdfTitle, setPdfTitle]         = useState('Service Report');
  const [webViewReady, setWebViewReady] = useState(false);
  const [isSharing, setIsSharing]       = useState(false);

  // isMountedRef: prevents state updates after unmount (e.g. fast back-navigation
  // while generation is still running in the background).
  const isMountedRef    = useRef(true);
  // isRunningRef: prevents re-entrant calls to generate() (e.g. rapid retry taps).
  const isRunningRef    = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── BackHandler: warn user if generation is in progress ──────────────────
  useEffect(() => {
    if (!isGenerating) return;

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Report in Progress',
        'The PDF is still generating. Going back will not cancel it — it will complete in the background.\n\nWould you like to go back anyway?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Go Back', style: 'destructive', onPress: () => router.back() },
        ],
      );
      return true; // Consume the back press — our Alert handles navigation
    });

    return () => handler.remove();
  }, [isGenerating]);

  // M6: `generate` as useCallback so the retry Alert always calls the current closure.
  const generate = useCallback(async () => {
    if (!jobId) return;

    // Re-entrant guard — prevents double-generation if the user taps Retry very fast
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    // Reset all display state for a clean retry experience
    setIsGenerating(true);
    setStage('fetching_data');
    setStageDetail(undefined);
    setWebViewReady(false);

    try {
      const result = await generateJobReport(jobId, (s, detail) => {
        if (!isMountedRef.current) return;
        setStage(s);
        setStageDetail(detail);
      });

      if (!isMountedRef.current) return;

      // FIX: stable path (no timestamp) — overwrites the previous HTML file
      // instead of accumulating a new one per generation in cacheDirectory.
      const fileUri = `${FileSystem.cacheDirectory}preview_${jobId}.html`;
      await FileSystem.writeAsStringAsync(fileUri, result.html);
      setHtmlContent(fileUri);
      setPdfUri(result.pdfUri);
      setPdfTitle(result.title);

      // FIX: Only show Toasts when something actually happened this call.
      // Cache hits (result.wasCacheHit=true) mean nothing was uploaded —
      // showing "Report Uploaded" would be misleading.
      if (result.completed && !result.wasCacheHit) {
        // A NEW upload just completed and the job was already in completed state
        updateJobStatus(jobId, JobStatus.Completed);
        Toast.show({
          type: 'success',
          text1: 'Report Uploaded',
          text2: 'Admin can now access this report.',
        });
      } else if (result.completed && result.wasCacheHit) {
        // Just opened a cached report for a completed job — no Toast needed,
        // the report is already there and the user can immediately share it.
        // Silently proceed.
      } else if (result.reportUrl && !result.wasCacheHit) {
        // A NEW draft PDF was saved to cloud for an in-progress job
        Toast.show({
          type: 'info',
          text1: 'Draft Preview Saved',
          text2: 'Complete the job first to finalise this report.',
        });
      }

      setIsGenerating(false);
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      const msg = e instanceof Error ? e.message : 'Unknown error occurred';
      console.error('[UMA BUILDING SERVICES] Preview generation failed:', e);
      Alert.alert(
        'Generation Failed',
        'The PDF report could not be generated.\n\n' + msg,
        [
          {
            text: 'Retry',
            // M6: Calling the stable useCallback ref — never a stale closure
            onPress: () => generate(),
          },
          { text: 'Go Back', style: 'cancel', onPress: () => router.back() },
        ],
      );
      setIsGenerating(false);
    } finally {
      isRunningRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Kick off generation on mount
  useEffect(() => {
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const handleShare = useCallback(async () => {
    if (!pdfUri || isSharing) return;
    setIsSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Toast.show({ type: 'error', text1: 'Sharing not available on this device' });
        return;
      }
      await Sharing.shareAsync(pdfUri, {
        mimeType:    'application/pdf',
        dialogTitle: pdfTitle,
        UTI:         'com.adobe.pdf',
      });
    } catch (e) {
      console.error('[UMA BUILDING SERVICES] Share failed:', e);
      Toast.show({ type: 'error', text1: 'Failed to share report', text2: 'Please try again' });
    } finally {
      setIsSharing(false);
    }
  }, [pdfUri, pdfTitle, isSharing]);

  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        title={isGenerating ? 'Generating Report' : 'Report Preview'}
        showBack
        rightComponent={
          !isGenerating && pdfUri ? (
            <TouchableOpacity onPress={handleShare} disabled={isSharing} style={styles.headerShareBtn}>
              {isSharing ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : (
                <>
                  <MaterialCommunityIcons name="export-variant" size={18} color={C.accent} />
                  <Text style={[styles.headerShareTxt, { color: C.accent }]}>Share</Text>
                </>
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isGenerating ? (
        <GeneratingView
          stage={stage}
          detail={stageDetail}
          primaryColor={C.primary}
          textColor={C.text}
          textSecondary={C.textSecondary}
          surface={C.surface}
          border={C.border}
        />
      ) : (
        <Animated.View entering={FadeInDown} style={{ flex: 1 }}>
          {!webViewReady && (
            <View style={[styles.loadingOverlay, { backgroundColor: C.background }]}>
              <ActivityIndicator color={C.primary} size="large" />
              <Text style={[styles.loadingOverlayTxt, { color: C.textSecondary }]}>Rendering document…</Text>
            </View>
          )}

          {htmlContent ? (
            <WebView
              originWhitelist={['*']}
              source={{ uri: htmlContent }}
              allowFileAccess={true}
              // FIX: allowFileAccessFromFileURLs is required on Android for data: URIs
              // embedded in a file:// HTML to load (photos encoded as base64 data URIs).
              allowFileAccessFromFileURLs={true}
              // FIX: scalesPageToFit is deprecated on Android. Use injectedJavaScript
              // to set a proper viewport meta tag so the 794px A4 layout scales to
              // fit the device screen width correctly on both iOS and Android.
              scalesPageToFit={Platform.OS === 'ios'}
              injectedJavaScript={Platform.OS === 'android' ? VIEWPORT_INJECTION : undefined}
              style={{ flex: 1, backgroundColor: C.surface }}
              onLoadEnd={() => setWebViewReady(true)}
              showsVerticalScrollIndicator={false}
              bounces={false}
            />
          ) : (
            <View style={[styles.errorView, { backgroundColor: C.background }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color={C.error} />
              <Text style={[styles.errorTxt, { color: C.text }]}>Report layout could not be loaded.</Text>
              <Button title="Retry" onPress={generate} style={{ marginTop: 20 }} />
            </View>
          )}

          <View style={[styles.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border, shadowColor: C.shadow, paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Button
              title="Share PDF"
              icon="export-variant"
              onPress={handleShare}
              loading={isSharing}
              disabled={!pdfUri || isSharing}
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
}
```

*Size: **392** lines of code.*

---

## 📄 `app/(app)/jobs/[id]/quote.tsx`

> **Description:** Quote Screen — app/(app)/jobs/[id]/quote.tsx Read-only summary for the technician. Defects are grouped by severity (Critical / Major / Minor). Prices shown if admin has set them — otherwise "Unquoted". Total is summed from quote_price values. No editing on this screen — all quote management is admin-only.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function QuoteScreen`
```tsx
export default function QuoteScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = useDefectsStore();

  useEffect(() => {
    if (!jobId) return;
    store.loadDefects(jobId);

    // A18: Re-load defects whenever a sync cycle completes so admin-updated
    // prices appear immediately without requiring a screen remount.
    const listener = () => store.loadDefects(jobId);
    onSyncComplete(listener);
    return () => offSyncComplete(listener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Group defects by severity
  const grouped = useMemo(() => ({
    critical: store.defects.filter(d => d.severity === DefectSeverity.Critical),
    major:    store.defects.filter(d => d.severity === DefectSeverity.Major),
    minor:    store.defects.filter(d => d.severity === DefectSeverity.Minor),
  }), [store.defects]);

  // Running total from admin-set prices
  const total = useMemo(
    () => store.defects.reduce((sum, d) => sum + (Number(d.quote_price) || 0), 0),
    [store.defects],
  );

  const hasDefects = store.defects.length > 0;

  const renderGroup = (key: 'critical' | 'major' | 'minor', delay: number) => {
    const defects = grouped[key];
    if (defects.length === 0) return null;
    const cfg = SEV[key === 'critical' ? DefectSeverity.Critical : key === 'major' ? DefectSeverity.Major : DefectSeverity.Minor];
    const groupColor = cfg.color(C);
    return (
      <Animated.View key={key} entering={FadeInDown.delay(delay).duration(340)}>
        <View style={s.groupHeader}>
          <View style={[s.groupDot, { backgroundColor: groupColor }]} />
          <MaterialCommunityIcons name={cfg.icon} size={14} color={groupColor} />
          <Text style={[s.groupTitle, { color: C.textTertiary }]}>
            {cfg.label} ({defects.length})
          </Text>
        </View>
        {defects.map(d => (
          <DefectRow key={d.id} defect={d} color={groupColor} C={C} />
        ))}
      </Animated.View>
    );
  };

  if (store.isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader eyebrow="QUOTE SUMMARY" title="Quote" showBack />
        <View style={{ paddingTop: 24, gap: 12 }}>
          <SkeletonCard /><SkeletonCard />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="QUOTE SUMMARY"
        title="Quote"
        subtitle={`${store.defects.length} defect${store.defects.length !== 1 ? 's' : ''} logged`}
        showBack
        rightComponent={
          hasDefects && total > 0 ? (
            <View style={[s.totalBadge, { backgroundColor: C.successLight, borderColor: C.success + '50' }]}>
              <Text style={[s.totalBadgeTxt, { color: C.success }]}>${total.toFixed(2)}</Text>
            </View>
          ) : undefined
        }
      />

      {/* F5: Contextual empty state — explains the expected flow so techs aren't confused */}
      {!hasDefects ? (
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
          <EmptyState
            icon="file-document-outline"
            title="No defects logged yet"
            subtitle="Defects you log during the on-site inspection will appear here, grouped by severity. Admin will then set pricing for each item."
          />
          <View style={[s.infoBanner, { backgroundColor: C.infoLight, borderColor: C.info + '30' }]}>
            <MaterialCommunityIcons name="information-outline" size={16} color={C.info} />
            <Text style={[s.infoBannerTxt, { color: C.infoDark }]}>
              Prices and quote approval are managed by your admin — you only need to log the defects found on site.
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* Admin-managed info banner */}
          <Animated.View entering={FadeInDown.delay(20).duration(300)}>
            <View style={[s.infoBanner, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
              <MaterialCommunityIcons name="shield-account-outline" size={16} color={C.textSecondary} />
              <Text style={[s.infoBannerTxt, { color: C.textSecondary }]}>
                Prices and quote approval are managed by the admin portal
              </Text>
            </View>
          </Animated.View>

          {/* Defect groups */}
          {renderGroup('critical', 60)}
          {renderGroup('major',    90)}
          {renderGroup('minor',    120)}

          {/* Total footer */}
          <Animated.View entering={FadeInDown.delay(150).duration(340)}>
            <View style={[s.totalCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={s.totalRow}>
                <Text style={[s.totalLabel, { color: C.textSecondary }]}>Subtotal (ex-GST)</Text>
                <Text style={[s.totalValue, { color: total > 0 ? C.success : C.textTertiary }]}>
                  {total > 0 ? `$${total.toFixed(2)}` : 'Pending pricing'}
                </Text>
              </View>
              {total === 0 && (
                <Text style={[s.totalNote, { color: C.textTertiary }]}>
                  Prices will be filled by the admin once the quote is reviewed
                </Text>
              )}
            </View>
          </Animated.View>

        </ScrollView>
      )}
    </View>
  );
}
```

*Size: **241** lines of code.*

---

## 📄 `app/(app)/jobs/[id]/report.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function ReportSummaryScreen`
```tsx
export default function ReportSummaryScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();

  const [job, setJob]             = useState<JobWithProperty | null>(null);
  const [assets, setAssets]       = useState<ReportAsset[]>([]);
  const [defects, setDefects]     = useState<ExtendedDefect[]>([]);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    if (!jobId) return;
    try {
      const j = getJobById<JobWithProperty>(jobId);
      if (!j) { setIsLoading(false); return; }
      setJob(j);

      const a = getAssetsWithJobResults<ReportAsset>(jobId, j.property_id);
      setAssets(a);
      setDefects(getDefectsForJob<ExtendedDefect>(jobId));
      setSignature(getSignatureForJob(jobId));

      const pendingSyncs = getPendingSyncItems();
      // Only tables whose data appears directly in the PDF HTML trigger the banner.
      // inspection_photos is intentionally excluded: the PDF encodes photos from
      // local_uri at generation time, so a pending Supabase INSERT for
      // inspection_photos does NOT make the PDF stale.
      const PDF_TABLES = new Set(['job_assets', 'defects', 'signatures', 'jobs']);
      const MAX_RETRIES = 5;
      const hasPending = pendingSyncs.some(item => {
        const op = String(item.operation);
        if (op === 'photo_upload') return false;            // binary upload task
        if ((item.retry_count ?? 0) >= MAX_RETRIES) return false; // permanently failed
        if (!PDF_TABLES.has(item.table_name)) return false; // not PDF-relevant
        return (item.payload ?? '').includes(`"${jobId}"`);
      });
      setHasPendingSync(hasPending);

    } catch (e) {
      console.error('[ReportSummary] load error:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <View style={[s.screen, s.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[s.screen, s.center, { backgroundColor: C.background }]}>
        <MaterialCommunityIcons name="file-document-outline" size={48} color={C.textTertiary} style={{ marginBottom: 16 }} />
        <Text style={{ color: C.textSecondary }}>Report data not found</Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  // Derived stats
  const totalAssets = assets.length;
  const passedCount = assets.filter(a => a.result === 'pass').length;
  const failedCount = assets.filter(a => a.result === 'fail').length;
  const ntCount     = assets.filter(a => !a.result || a.result === 'not_tested').length;
  const compliantCount = assets.filter(a => a.is_compliant).length;

  const progressPct = totalAssets > 0 ? (passedCount / totalAssets) * 100 : 0;
  const failPct     = totalAssets > 0 ? (failedCount / totalAssets) * 100 : 0;
  const ntPct       = totalAssets > 0 ? (ntCount / totalAssets) * 100 : 0;

  // FIX: After Phase 2 auto-marking, 'not_tested' IS a valid final state.
  // Previously only pass+fail counted toward completion, meaning a job with
  // any NT assets was never considered "fully inspected" even though the
  // tech had reviewed every asset (some just couldn't be tested).
  // Correct check: every asset has a non-null result.
  const isFullyInspected = assets.length > 0 && assets.every(a => a.result !== null);
  const hasSignature     = !!signature?.signature_url;
  const readyToGenerate  = isFullyInspected && hasSignature;
  const isCompleted      = job.status === 'completed';

  // F5: Technician Info (for top banner)
  // Retrieve the technician's name from SQLite `users` table instead of hardcoding
  const techRecord = getRecord<{ full_name: string }>('users', job.assigned_to);
  const techName   = techRecord?.full_name ?? 'Site Technician';
  const reportDate = new Date().toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow={`JOB #${job.id.substring(0, 8).toUpperCase()}`}
        title="Report Summary"
        showBack
      />

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* ── Top Hero Card: Property Info ── */}
        <Animated.View entering={FadeInDown.delay(40).duration(340)}>
          <Card variant="default" style={{ marginBottom: 20, position: 'relative', overflow: 'hidden' }} padding={16}>
            <View style={[s.heroDecor, { backgroundColor: C.primary + '10' }]} />
            <View style={s.heroInner}>
              <View style={s.heroTopRow}>
                <View style={[s.heroIconWrap, { backgroundColor: C.primary + '15' }]}>
                  <MaterialCommunityIcons name="office-building-marker" size={20} color={C.primary} />
                </View>
                <View style={[s.heroBadge, { backgroundColor: C.backgroundTertiary }]}>
                  <Text style={[s.heroBadgeTxt, { color: C.textSecondary }]}>
                    {isCompleted ? 'COMPLETED' : readyToGenerate ? 'READY TO GENERATE' : isFullyInspected ? 'AWAITING SIGNATURE' : 'IN PROGRESS'}
                  </Text>
                </View>
              </View>
              <Text style={[s.heroTitle, { color: C.text }]}>{job.property_name || 'Property Report'}</Text>
              <Text style={[s.heroSub, { color: C.textSecondary }]}>
                {[job.property_address, job.property_suburb].filter(Boolean).join(', ')}
              </Text>

              <View style={[s.heroDivider, { backgroundColor: C.border }]} />

              <View style={s.heroMetaRow}>
                <View style={s.heroMetaItem}>
                  <MaterialCommunityIcons name="calendar-check" size={14} color={C.textSecondary} />
                  <Text style={[s.heroMetaTxt, { color: C.text }]}>{reportDate}</Text>
                </View>
                <View style={s.heroMetaItem}>
                  <MaterialCommunityIcons name="account-hard-hat" size={14} color={C.textSecondary} />
                  <Text style={[s.heroMetaTxt, { color: C.text }]}>{techName}</Text>
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* ── Pending Data Changes Warning Banner ── */}
        {hasPendingSync && (
          <Animated.View entering={FadeInDown.delay(60).duration(340)}>
            <View style={[s.warningBanner, { backgroundColor: C.warningLight, borderColor: C.warning + '40' }]}>
              <MaterialCommunityIcons name="cloud-sync-outline" size={24} color={C.warningDark} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.warningDark, marginBottom: 2 }}>
                  Inspection Data Not Yet in PDF
                </Text>
                <Text style={{ fontSize: 12, color: C.warningDark, lineHeight: 16 }}>
                  Results or signatures were recorded after the last PDF was generated. Tap Regenerate to update it.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Warning if completed job lacks signature (data corruption edge case) ── */}
        {isCompleted && !hasSignature && (
          <Animated.View entering={FadeIn.delay(200)}>
            <View style={[s.warningBanner, { backgroundColor: C.errorLight, borderColor: C.error }]}>
              <MaterialCommunityIcons name="alert" size={20} color={C.error} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.errorDark, fontWeight: '800', fontSize: 13 }}>Missing Signature</Text>
                <Text style={{ color: C.errorDark, fontSize: 12, marginTop: 2 }}>This report was completed without a client signature.</Text>
              </View>
              <Button
                title="Sign" variant="secondary"
                onPress={() => router.push(`/jobs/${job.id}/signature` as never)}
                style={{ height: 36, paddingHorizontal: 12 }}
              />
            </View>
          </Animated.View>
        )}

        {/* ── Stats Grid (2x2) ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(340)}>
          <View style={s.statsGrid}>
            <StatCard
              icon="shield-check" iconColor={C.success} iconBg={C.successLight}
              value={totalAssets} label="Total" valueColor={C.text}
              surface={C.surface} border={C.border}
            />
            <StatCard
              icon="check-circle" iconColor={C.success} iconBg={C.successLight}
              value={passedCount} label="Passed" valueColor={C.success}
              surface={C.surface} border={C.border}
            />
            <StatCard
              icon="close-circle" iconColor={C.error} iconBg={C.errorLight}
              value={failedCount} label="Failed" valueColor={failedCount > 0 ? C.error : C.text}
              surface={C.surface} border={C.border}
            />
            <StatCard
              icon="minus-circle" iconColor={C.textSecondary} iconBg={C.backgroundTertiary}
              value={ntCount} label="Not Tested" valueColor={C.textSecondary}
              surface={C.surface} border={C.border}
            />
          </View>
        </Animated.View>

        {/* ── Results Bar ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(340)}>
          <Card variant="default" style={{ marginBottom: 16 }} padding={16}>
            <View style={s.barHeader}>
              <Text style={[s.barTitle, { color: C.textSecondary, flex: 1, marginRight: 8 }]} numberOfLines={1}>COMPLIANCE BREAKDOWN</Text>
              <Text style={[s.barPct, { color: C.text }]}>{Math.round(progressPct)}% Pass</Text>
            </View>
            <View style={[s.barTrack, { backgroundColor: C.backgroundTertiary }]}>
              {/* Stacked bar segments */}
              <Animated.View style={[s.barSegment, { backgroundColor: C.success, width: `${progressPct}%` as `${number}%` }]} />
              <Animated.View style={[s.barSegment, { backgroundColor: C.error, width: `${failPct}%` as `${number}%` }]} />
              <Animated.View style={[s.barSegment, { backgroundColor: C.textSecondary, width: `${ntPct}%` as `${number}%` }]} />
            </View>
            <View style={s.barLegend}>
              <Text style={[s.barLegendTxt, { color: C.textTertiary }]}>
                {compliantCount} compliant · {totalAssets - compliantCount} non-compliant
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* ── Documentation Checklist (Status) ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(340)}>
          <SectionTitle title="Documentation" />
          <Card variant="default" noPadding style={{ marginBottom: 16, overflow: 'hidden' }}>
            {/* Inspections Row */}
            <View style={[s.checkRow, { borderBottomColor: C.border }]}>
              <View style={[s.checkIconWrap, { backgroundColor: isFullyInspected ? C.success + '18' : C.warning + '18' }]}>
                <MaterialCommunityIcons
                  name={isFullyInspected ? "clipboard-check-outline" : "clipboard-text-clock-outline"}
                  size={18} color={isFullyInspected ? C.success : C.warning}
                />
              </View>
              <View style={s.checkTextCol}>
                <Text style={[s.checkTitle, { color: C.text }]}>Asset Inspections</Text>
                <Text style={[s.checkSub, { color: C.textSecondary }]}>
                  {isFullyInspected ? 'All assets inspected' : `${ntCount} assets remaining`}
                </Text>
              </View>
              <MaterialCommunityIcons name={isFullyInspected ? 'check-circle' : 'circle-outline'} size={20} color={isFullyInspected ? C.success : C.borderStrong} />
            </View>

            {/* Defects Row */}
            <View style={[s.checkRow, { borderBottomColor: C.border }]}>
              <View style={[s.checkIconWrap, { backgroundColor: C.primary + '18' }]}>
                <MaterialCommunityIcons name="tools" size={18} color={C.primary} />
              </View>
              <View style={s.checkTextCol}>
                <Text style={[s.checkTitle, { color: C.text }]}>Defects & Remediation</Text>
                <Text style={[s.checkSub, { color: C.textSecondary }]}>
                  {defects.length === 0 ? 'No defects logged' : `${defects.length} defect(s) logged`}
                </Text>
              </View>
              <MaterialCommunityIcons name="check-circle" size={20} color={C.success} />
            </View>

            {/* Signature Row */}
            <TouchableOpacity
              style={[s.checkRow, { borderBottomWidth: 0 }]}
              onPress={() => !isCompleted && router.push(`/jobs/${job.id}/signature` as never)}
              activeOpacity={0.7}
              disabled={isCompleted}
            >
              <View style={[s.checkIconWrap, { backgroundColor: hasSignature ? C.success + '18' : C.errorLight }]}>
                <MaterialCommunityIcons name="draw" size={18} color={hasSignature ? C.success : C.error} />
              </View>
              <View style={s.checkTextCol}>
                <Text style={[s.checkTitle, { color: C.text }]}>Client Signature</Text>
                <Text style={[s.checkSub, { color: hasSignature ? C.success : C.error }]}>
                  {hasSignature ? 'Captured and attached' : 'Required for submission'}
                </Text>
              </View>
              {hasSignature ? (
                <MaterialCommunityIcons name="check-circle" size={20} color={C.success} />
              ) : (
                <View style={[s.actionBtn, { backgroundColor: C.error }]}>
                  <Text style={s.actionBtnTxt}>Sign</Text>
                </View>
              )}
            </TouchableOpacity>
          </Card>
        </Animated.View>

        {/* ── Asset Breakdown Table ── */}
        <Animated.View entering={FadeInDown.delay(140).duration(340)}>
          <SectionTitle title="Asset Breakdown" />
          <Card variant="default" noPadding style={{ marginBottom: 16, overflow: 'hidden' }}>
            {assets.length === 0 ? (
              <View style={s.emptyTable}>
                <Text style={{ color: C.textTertiary, fontSize: 13 }}>No assets inspected.</Text>
              </View>
            ) : (
              assets.map((a, i) => (
                <AssetRow key={a.id} asset={a} index={i} isLast={i === assets.length - 1} colors={C} />
              ))
            )}
          </Card>
        </Animated.View>

        {/* ── Defect Summary ── */}
        {defects.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(340)}>
            <SectionTitle title="Logged Defects" />
            <View style={{ gap: 12 }}>
              {defects.map((d, i) => <DefectCard key={d.id} defect={d} index={i} colors={C} />)}
            </View>
          </Animated.View>
        )}

      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {isCompleted && job.report_url ? (
          // When inspection data changed since last PDF: hide Download, show Regenerate only
          hasPendingSync ? (
            <Button
              title="Regenerate Report"
              icon="refresh"
              variant="primary"
              onPress={() => router.push(`/jobs/${jobId}/preview` as never)}
            />
          ) : (
            <View style={s.bottomBtnRow}>
              <Button
                title="Open PDF"
                icon="file-eye-outline"
                variant="primary"
                onPress={() => router.push(`/jobs/${jobId}/preview` as never)}
                style={{ flex: 1 }}
              />
              <Button
                title="Refresh"
                icon="refresh"
                variant="secondary"
                // FIX: Refresh re-checks local sync state without re-generating PDF.
                // Previously this was a duplicate of "Open PDF" — both navigated
                // to /preview, which was confusing and wasted the user's time.
                onPress={onRefresh}
                style={{ flex: 1 }}
              />
            </View>
          )
        ) : (
          <Button
            title={readyToGenerate ? "Generate Report PDF" : "Preview Draft Report"}
            icon={readyToGenerate ? "file-pdf-box" : "file-eye-outline"}
            variant={readyToGenerate ? "primary" : "secondary"}
            onPress={() => router.push(`/jobs/${jobId}/preview` as never)}
          />
        )}
      </View>
    </View>
  );
}
```

*Size: **671** lines of code.*

---

## 📄 `app/(app)/jobs/[id]/signature.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function SignatureScreen`
```tsx
export default function SignatureScreen() {
  const C = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  // ONE canvas ref — we only ever mount one canvas at a time
  const canvasRef = useRef<CanvasRef | null>(null);
  // Scroll ref — lock/unlock WITHOUT a state update (zero re-renders mid-draw)
  const scrollRef = useRef<ScrollView>(null);

  const [signedBy, setSignedBy]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [sigError, setSigError]     = useState('');
  const [hasSig, setHasSig]         = useState(false);
  const [existingSig, setExistingSig] = useState<Signature | null>(null);
  const [isEditing, setIsEditing]   = useState(false);
  const [step, setStep]             = useState<'tech' | 'client'>('tech');
  const [techSigBase64, setTechSigBase64] = useState<string | null>(null);

  const existingRecordId = useRef<string | null>(null);
  // Safety timer ref — never stored on the canvas ref
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load existing / draft ──────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const existing = getSignatureForJob(id) as Signature | null;
    if (existing) {
      setExistingSig(existing);
      setSignedBy(existing.signed_by_name || '');
      existingRecordId.current = existing.id ?? null;
    } else {
      AsyncStorage.getItem(`draft_tech_sig_${id}`).then(draft => {
        if (draft) { setTechSigBase64(draft); setStep('client'); }
      });
    }
    return () => {
      // Clear draft on unmount — prevents cross-job bleed (BUG-N8)
      AsyncStorage.removeItem(`draft_tech_sig_${id}`).catch(() => {});
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, [id]);

  const CONSENT =
    'By signing below, I confirm that the inspection described in this report was ' +
    'completed on the property on the date shown, and that I have been given the ' +
    'opportunity to review the findings. This signature is legally binding under ' +
    'the Electronic Transactions Act 1999 (Cth).';

  // ── Scroll lock — NO state update, direct ref call ────────────────────
  // This is the core fix for "canvas acts like a scroll bar".
  // Previously setScrollEnabled(false) triggered a re-render mid-draw,
  // causing the gesture to be interrupted. Now we call setNativeProps
  // directly on the ScrollView — zero re-renders, zero jank.
  const lockScroll   = useCallback(() => { scrollRef.current?.setNativeProps({ scrollEnabled: false }); }, []);
  const unlockScroll = useCallback(() => { scrollRef.current?.setNativeProps({ scrollEnabled: true  }); }, []);

  // ── Canvas event handlers ──────────────────────────────────────────────
  const handleBegin = useCallback(() => {
    setHasSig(true);
    lockScroll();
  }, [lockScroll]);

  const handleEnd = useCallback(() => {
    unlockScroll();
  }, [unlockScroll]);

  // ── Clear current canvas ───────────────────────────────────────────────
  function handleClear() {
    canvasRef.current?.clearSignature();
    setHasSig(false);
  }

  function handleResetAll() {
    Alert.alert('Restart Sign-off', 'This will delete the captured technician signature. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: async () => {
        if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
        if (id) await AsyncStorage.removeItem(`draft_tech_sig_${id}`);
        setStep('tech'); setTechSigBase64(null); setHasSig(false); setSigError('');
      }},
    ]);
  }

  // ── Next / Save ────────────────────────────────────────────────────────
  function handleNextOrSave() {
    if (step === 'tech') {
      if (!hasSig) { setSigError('Please draw the technician signature before continuing.'); return; }
      setSigError('');
      setSaving(true);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        setSaving(false);
        setSigError('Signature capture timed out — please try again.');
      }, 10_000);
      canvasRef.current?.readSignature();
    } else {
      if (!signedBy.trim()) { setSigError('Please enter the name of the authorised person.'); return; }
      if (!hasSig)          { setSigError('Please draw the client signature before saving.'); return; }
      setSigError('');
      setSaving(true);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        setSaving(false);
        setSigError('Signature capture timed out — please try again.');
      }, 10_000);
      canvasRef.current?.readSignature();
    }
  }

  // ── onOK from canvas ──────────────────────────────────────────────────
  async function handleOK(signature: string) {
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }

    if (step === 'tech') {
      await AsyncStorage.setItem(`draft_tech_sig_${id}`, signature);
      setTechSigBase64(signature);
      setStep('client');
      setHasSig(false);
      setSaving(false);
      return;
    }

    // Client step — final save
    try {
      const now      = new Date().toISOString();
      const recordId = existingRecordId.current ?? generateUUID();
      const isUpdate = !!existingRecordId.current;
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const record: Record<string, string | null> = {
        id: recordId,
        job_id: id!,
        company_id: companyId,
        signature_url: signature,
        tech_signature_url: techSigBase64,
        signed_by_name: signedBy.trim(),
        signed_at: now,
        device_info: Platform.OS === 'ios' ? 'iOS' : 'Android',
      };
      upsertRecord('signatures', record);
      addToSyncQueue('signatures', recordId, isUpdate ? SyncOperation.Update : SyncOperation.Insert, record);
      void runSync();
      if (id) await AsyncStorage.removeItem(`draft_tech_sig_${id}`);
      existingRecordId.current = recordId;
      setSaving(false);
      setIsEditing(false);
      const refreshed = getSignatureForJob(id!) as Signature | null;
      if (refreshed) setExistingSig(refreshed);
      Alert.alert('Signature Saved', 'All signatures have been recorded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setSaving(false);
      setSigError('Failed to save signature. Please try again.');
    }
  }

  // ── Client Unavailable ────────────────────────────────────────────────
  async function handleClientUnavailable() {
    if (!techSigBase64) {
      setSigError('Technician must sign first before marking client as unavailable.');
      return;
    }
    setSaving(true);
    try {
      const now      = new Date().toISOString();
      const recordId = existingRecordId.current ?? generateUUID();
      const isUpdate = !!existingRecordId.current;
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const record: Record<string, string | null> = {
        id: recordId, job_id: id!,
        company_id: companyId,
        signature_url: 'UNAVAILABLE',
        tech_signature_url: techSigBase64,
        signed_by_name: 'Client Unavailable',
        signed_at: now,
        device_info: Platform.OS === 'ios' ? 'iOS' : 'Android',
      };
      upsertRecord('signatures', record);
      addToSyncQueue('signatures', recordId, isUpdate ? SyncOperation.Update : SyncOperation.Insert, record);
      void runSync();
      if (id) await AsyncStorage.removeItem(`draft_tech_sig_${id}`);
      existingRecordId.current = recordId;
      setSaving(false);
      setIsEditing(false);
      const refreshed = getSignatureForJob(id!) as Signature | null;
      if (refreshed) setExistingSig(refreshed);
      Alert.alert('Recorded', 'Technician signature captured. Client was unavailable.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setSaving(false);
      setSigError('Failed to record. Please try again.');
    }
  }

  const showCanvas   = !existingSig || isEditing;
  const showTechView = !showCanvas; // view-only after completion
  const isClientStep = step === 'client';

  // Shared canvas webStyle — hides the library's own buttons/footer
  const CANVAS_STYLE = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: transparent; overflow: hidden; }
    .m-signature-pad { box-shadow: none !important; border: none !important; background: #FFFFFF; width: 100%; height: 100%; }
    .m-signature-pad--body { border: none !important; background: #FFFFFF; width: 100%; height: 100%; }
    .m-signature-pad--footer { display: none !important; }
    canvas { touch-action: none; }
  `;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>

      {/* ── Header ── */}
      <ScreenHeader
        eyebrow="JOB SIGN-OFF"
        title="Sign-Off"
        showBack={true}
        rightComponent={
          showCanvas ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {isClientStep && (
                <TouchableOpacity onPress={handleResetAll} style={[s.headerBtn, { backgroundColor: C.backgroundTertiary }]}>
                  <MaterialCommunityIcons name="refresh" size={15} color={C.textSecondary} />
                  <Text style={[s.headerBtnTxt, { color: C.textSecondary }]}>Restart</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClear} style={[s.headerBtn, { backgroundColor: C.backgroundTertiary }]}>
                <MaterialCommunityIcons name="eraser" size={15} color={C.textSecondary} />
                <Text style={[s.headerBtnTxt, { color: C.textSecondary }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      {/* ── Body ── */}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // Start with scroll enabled; lockScroll/unlockScroll toggle via setNativeProps
        scrollEnabled={true}
      >

        {/* Consent */}
        <Card variant="info" style={{ marginBottom: 16 }}>
          <View style={s.consentRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={15} color={C.info} />
            <Text style={[s.consentTitle, { color: C.info }]}>CONSENT STATEMENT</Text>
          </View>
          <Text style={[s.consentTxt, { color: C.textSecondary }]}>{CONSENT}</Text>
        </Card>

        {/* ── Existing sig banner ── */}
        {existingSig && !isEditing && (
          <Card variant="success" style={s.bannerCard} padding={14}>
            <MaterialCommunityIcons name="check-circle" size={16} color={C.success} />
            <Text style={[s.bannerTxt, { color: C.successDark }]}>
              Signed by {existingSig.signed_by_name} · {new Date(existingSig.signed_at).toLocaleDateString('en-AU')}
            </Text>
            <TouchableOpacity
              onPress={() => { setIsEditing(true); setStep('tech'); setHasSig(false); setSigError(''); }}
              style={[s.resignBtn, { backgroundColor: C.warning + '20', borderColor: C.warning + '60' }]}
            >
              <MaterialCommunityIcons name="pencil-outline" size={13} color={C.warningDark} />
              <Text style={[s.resignTxt, { color: C.warningDark }]}>Re-sign</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* ── Step indicator ── */}
        {showCanvas && (
          <View style={[s.stepRow, { borderColor: C.border }]}>
            <View style={[s.stepPill, { backgroundColor: C.accent }]}>
              <Text style={s.stepPillTxt}>
                {step === 'tech' ? 'STEP 1 OF 2' : 'STEP 2 OF 2'}
              </Text>
            </View>
            <Text style={[s.stepLabel, { color: C.textSecondary }]}>
              {step === 'tech' ? 'Technician Sign-off' : 'Client Sign-off'}
            </Text>
          </View>
        )}

        {/* ─────────────── TECHNICIAN SIGNATURE ─────────────── */}
        <Text style={[s.fieldLabel, { color: C.textTertiary, marginTop: 16 }]}>TECHNICIAN SIGNATURE *</Text>

        <View style={[s.canvasCard, { borderColor: C.border, backgroundColor: '#FFFFFF' }]}>

          {/* View-only: existing sig captured */}
          {showTechView && (
            existingSig?.tech_signature_url
              ? <Image source={{ uri: existingSig.tech_signature_url }} style={s.sigImage} resizeMode="contain" />
              : <View style={s.emptyState}>
                  <MaterialCommunityIcons name="draw" size={24} color={C.textTertiary} />
                  <Text style={[s.emptyTxt, { color: C.textTertiary }]}>No technician signature on file</Text>
                </View>
          )}

          {/* Active step = tech: show canvas */}
          {showCanvas && step === 'tech' && (
            <>
              <SignatureScreenCanvas
                ref={canvasRef}
                onOK={handleOK}
                onEmpty={() => { setSaving(false); setSigError('Please draw a signature first.'); }}
                onBegin={handleBegin}
                onEnd={handleEnd}
                descriptionText=""
                clearText="Clear"
                confirmText="Save"
                webStyle={CANVAS_STYLE}
                autoClear={false}
                backgroundColor="#FFFFFF"
                penColor="#111827"
                style={s.canvasInner}
                nestedScrollEnabled={false}
              />
              {!hasSig && (
                <View style={s.hint} pointerEvents="none">
                  <MaterialCommunityIcons name="draw" size={26} color={C.textTertiary} />
                  <Text style={[s.hintTxt, { color: C.textTertiary }]}>Draw technician signature here</Text>
                </View>
              )}
            </>
          )}

          {/* Captured tech sig displayed while on client step */}
          {showCanvas && step === 'client' && techSigBase64 && (
            <Image source={{ uri: techSigBase64 }} style={s.sigImage} resizeMode="contain" />
          )}
        </View>

        {/* ─────────────── CLIENT SIGNATURE ─────────────── */}
        {(isClientStep || showTechView) && (
          <View style={{ marginTop: 24 }}>
            <Text style={[s.fieldLabel, { color: C.textTertiary }]}>AUTHORISED PERSON — FULL NAME *</Text>
            <View style={[s.inputRow, { backgroundColor: C.surface, borderColor: (!signedBy && sigError) ? C.error : C.border }]}>
              <MaterialCommunityIcons name="account-outline" size={18} color={C.textTertiary} />
              <TextInput
                style={[s.nameInput, { color: C.text }]}
                placeholder="e.g. John Smith"
                placeholderTextColor={C.textTertiary}
                value={signedBy}
                onChangeText={t => { setSignedBy(t); setSigError(''); }}
                autoCapitalize="words"
                returnKeyType="done"
                maxLength={MAX_LENGTHS.name}
                editable={showCanvas}
              />
            </View>

            <Text style={[s.fieldLabel, { color: C.textTertiary, marginTop: 16 }]}>CLIENT SIGNATURE *</Text>

            <View style={[s.canvasCard, { borderColor: C.border, backgroundColor: '#FFFFFF' }]}>

              {/* View-only */}
              {showTechView && (
                existingSig?.signature_url === 'UNAVAILABLE'
                  ? <View style={s.emptyState}>
                      <MaterialCommunityIcons name="account-off-outline" size={26} color={C.warning} />
                      <Text style={[s.emptyTxt, { color: C.warningDark, fontWeight: '700' }]}>Client Unavailable</Text>
                      <Text style={[s.emptyTxt, { color: C.textTertiary }]}>No client signature captured</Text>
                    </View>
                  : <Image source={{ uri: existingSig?.signature_url }} style={s.sigImage} resizeMode="contain" />
              )}

              {/* Active client canvas */}
              {isClientStep && (
                <>
                  <SignatureScreenCanvas
                    ref={canvasRef}
                    onOK={handleOK}
                    onEmpty={() => { setSaving(false); setSigError('Please draw the client signature.'); }}
                    onBegin={handleBegin}
                    onEnd={handleEnd}
                    descriptionText=""
                    clearText="Clear"
                    confirmText="Save"
                    webStyle={CANVAS_STYLE}
                    autoClear={false}
                    backgroundColor="#FFFFFF"
                    penColor="#111827"
                    style={s.canvasInner}
                    nestedScrollEnabled={false}
                  />
                  {!hasSig && (
                    <View style={s.hint} pointerEvents="none">
                      <MaterialCommunityIcons name="draw" size={26} color={C.textTertiary} />
                      <Text style={[s.hintTxt, { color: C.textTertiary }]}>Draw client signature here</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[s.footer, { backgroundColor: C.surface, borderTopColor: C.border, paddingBottom: Math.max(insets.bottom, 20) }]}>

        {sigError ? (
          <Card variant="danger" style={s.errorCard} padding={12}>
            <MaterialCommunityIcons name="alert-circle" size={15} color={C.error} />
            <Text style={[s.errorTxt, { color: C.errorDark }]}>{sigError}</Text>
          </Card>
        ) : null}

        <View style={[s.legalRow, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
          <MaterialCommunityIcons name="lock-outline" size={11} color={C.textTertiary} />
          <Text style={[s.legalTxt, { color: C.textTertiary }]}>
            Electronic Transactions Act 1999 (Cth) · {Platform.OS === 'ios' ? 'iOS' : 'Android'} · {new Date().toLocaleDateString('en-AU')}
          </Text>
        </View>

        {showCanvas && (
          <View style={{ gap: 10 }}>
            <Button
              variant="primary"
              title={saving ? 'Processing…' : (step === 'tech' ? 'Next: Client Signature →' : 'Save All Signatures')}
              onPress={handleNextOrSave}
              disabled={saving}
              icon={step === 'tech' ? 'arrow-right-circle' : 'check-circle'}
            />
            {isClientStep && (
              <Button
                variant="secondary"
                title="Client Unavailable to Sign"
                onPress={handleClientUnavailable}
                disabled={saving}
              />
            )}
            {isEditing && (
              <Button
                variant="secondary"
                title="Cancel Re-sign"
                onPress={() => { setIsEditing(false); setStep('tech'); setHasSig(false); setSigError(''); }}
                disabled={saving}
              />
            )}
          </View>
        )}
      </View>

    </View>
  );
}
```

*Size: **529** lines of code.*

---

## 📄 `app/(app)/jobs/_layout.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function JobsLayout`
```tsx
export default function JobsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
```

*Size: **9** lines of code.*

---

## 📄 `app/(app)/notifications/index.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function NotificationsScreen`
```tsx
export default function NotificationsScreen() {
  const C = useColors();
  const {
    notifications, unreadCount, totalCount, isLoading,
    loadNotifications, markAllAsRead, clearAll,
  } = useNotificationsStore();
  const isCapped = totalCount > notifications.length;



  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAllAsRead();
  }, [markAllAsRead]);

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      {/* ── Header ──────────────── */}
      <ScreenHeader 
        title="Notifications" 
        showBack={true} 
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        rightComponent={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAll} style={s.markAllBtn}>
              <Text style={[s.markAllText, { color: C.accent }]}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* ── Content ─────────────────────────── */}
      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            s.list,
            notifications.length === 0 && s.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <NotifCard item={item} />}
          ListEmptyComponent={
            <EmptyState 
              icon="bell-outline" 
              title="No notifications yet" 
              subtitle="You're all caught up! New job assignments and system alerts will appear here." 
            />
          }
          ListFooterComponent={
            notifications.length > 0 ? (
              <View style={{ paddingBottom: 8 }}>
                {isCapped && (
                  <View style={[s.cappedBanner, { backgroundColor: C.warningLight }]}>
                    <MaterialCommunityIcons name="information-outline" size={14} color={C.warningDark} />
                    <Text style={[s.cappedText, { color: C.warningDark }]}>
                      Showing the {notifications.length} most recent notifications ({totalCount} total). Clear old ones to see more.
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={s.clearBtn}
                  onPress={() =>
                    Alert.alert(
                      'Clear all notifications?',
                      'This will permanently remove all notifications. This action cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear All', style: 'destructive', onPress: clearAll },
                      ]
                    )
                  }
                >
                  <MaterialCommunityIcons name="delete-sweep-outline" size={16} color={C.textTertiary} />
                  <Text style={[s.clearBtnText, { color: C.textTertiary }]}>Clear all notifications</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
```

*Size: **216** lines of code.*

---

## 📄 `app/(app)/profile.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function ProfileScreen`
```tsx
export default function ProfileScreen() {
  const { user } = useAuth();
  const { signOut, company, updateUser } = useAuthStore();
  const C = useColors();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: user?.phone || '',
  });

  function _confirmLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Any unsynced changes will sync next time you log in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            stopSync();
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  }

  const fpasExpiry = user?.fpas_expiry ? new Date(user.fpas_expiry) : null;
  const daysToFpasExpiry = fpasExpiry
    ? Math.ceil((fpasExpiry.getTime() - Date.now()) / 86400000)
    : null;

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    // Sanitize phone: strip anything that isn't digits, +, -, spaces or parentheses
    const phone = sanitizeText(editForm.phone.trim(), 15);
    const { data, error } = await supabase
      .from('users')
      .update({ phone })
      .eq('id', user.id)
      .select()
      .single();
    
    setIsSaving(false);
    if (error) {
      Alert.alert('Error', 'Failed to update profile.');
    } else {
      updateUser(data);
      setIsEditing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="My Profile"
        rightComponent={
          <TouchableOpacity onPress={() => isEditing ? handleSave() : setIsEditing(true)}>
            {isSaving ? <ActivityIndicator size="small" color={C.accent} /> : 
              <Text style={{ color: C.accent, fontWeight: '700', fontSize: 16 }}>{isEditing ? 'Save' : 'Edit'}</Text>}
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={[styles.avatarInitials, { color: C.textOnPrimary }]}>
              {user?.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('') ?? 'T'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.full_name ?? 'Technician'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
            <Badge status="active" label={(user?.role ?? 'Technician').replace(/\b\w/g, c => c.toUpperCase())} />
          </View>
        </View>

        {/* FPAS expiry warning */}
        {daysToFpasExpiry !== null && daysToFpasExpiry <= 60 && (
          <View style={[styles.warningBanner, daysToFpasExpiry <= 0 && styles.dangerBanner]}>
            <MaterialCommunityIcons
              name={daysToFpasExpiry <= 0 ? 'alert-circle' : 'alert'}
              size={16}
              color={daysToFpasExpiry <= 0 ? T.danger : T.warning}
            />
            <Text style={[styles.warningText, daysToFpasExpiry <= 0 && { color: T.danger }]}>
              {daysToFpasExpiry <= 0
                ? `FPAS accreditation EXPIRED — contact your office immediately`
                : `FPAS accreditation expires in ${daysToFpasExpiry} days`}
            </Text>
          </View>
        )}

        {/* Contact details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          {isEditing ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <TextInput 
                style={styles.input} 
                value={editForm.phone} 
                onChangeText={t => setEditForm(f => ({ ...f, phone: t }))} 
                placeholder="Phone number" 
                placeholderTextColor={C.textTertiary}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          ) : (
            <InfoRow label="Phone" value={user?.phone} />
          )}
          <InfoRow label="Email" value={user?.email} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FPAS Accreditation</Text>
          <InfoRow label="FPAS Number" value={user?.fpas_number} />
          <InfoRow label="FPAS Class"  value={user?.fpas_class} />
          <InfoRow label="FPAS Expiry" value={user?.fpas_expiry} />
          <InfoRow label="State Licence"   value={user?.state_license} />
          <InfoRow label="Licence Expiry"  value={user?.state_license_expiry} />
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <InfoRow label="Status"       value={user?.is_active ? 'Active' : 'Inactive'} />
          <InfoRow label="Member since" value={user?.created_at?.slice(0, 10)} />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={_confirmLogout} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>SiteTrack v2.0  •  {company?.name || 'Company'}</Text>
      </ScrollView>
    </View>
  );
}
```

*Size: **222** lines of code.*

---

## 📄 `app/(app)/properties/site-inspect/[id].tsx`

> **Description:** On-Site Inspection Form — launched from the Property Detail screen. Allows a technician to: • Mark each asset as Pass / Fail / N/T • Log a defect reason when failing an asset (inline — no modal needed) • Add new assets discovered on-site via AddAssetModal • Complete the inspection — results saved as a job+job_assets record
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function SiteInspectScreen`
```tsx
export default function SiteInspectScreen() {
  const C          = useColors();
  const { id: propertyId } = useLocalSearchParams<{ id: string }>();
  const { user }   = useAuth();

  const [property,      setProperty]      = useState<Property | null>(null);
  const [assets,        setAssets]        = useState<Asset[]>([]);
  const [results,       setResults]       = useState<Record<string, AssetResult>>({});
  const [isLoading,     setIsLoading]     = useState(true);
  const [isSaving,      setIsSaving]      = useState(false);
  const [filter,        setFilter]        = useState('All');
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showComplete,  setShowComplete]  = useState(false);
  const listRef = useRef<FlatList>(null);

  // Hide tab bar while

  // ── Load property + assets ────────────────────────────────
  const load = useCallback(() => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const p = getRecord<Property>('properties', propertyId);
      setProperty(p);
      if (p) {
        const a = getAssetsForProperty<Asset>(propertyId);
        setAssets(a);
        const init: Record<string, AssetResult> = {};
        a.forEach(asset => { init[asset.id] = initResult(); });
        setResults(init);
      }
    } catch (e) {
      console.error('[SiteInspect] load error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  // ── Decision #1: Back-press guard ───────────────────────
  // If any asset has been inspected, intercept Android back and the
  // navigation header back-button, and offer Save or Discard.
  const hasProgress = useMemo(
    () => Object.values(results).some(r => r.result !== null),
    [results]
  );

  const handleBackPress = useCallback(() => {
    if (!hasProgress) return false; // let navigation proceed normally
    Alert.alert(
      'Save Progress?',
      'You have inspected some assets. What would you like to do?',
      [
        {
          text: 'Keep Inspecting',
          style: 'cancel',
        },
        {
          text: 'Discard & Exit',
          style: 'destructive',
          onPress: () => router.back(),
        },
        {
          text: 'Save & Exit',
          onPress: () => {
            void saveInspection().then(() => router.back()).catch(() => router.back());
          },
        },
      ],
      { cancelable: false }
    );
    return true;
  }, [hasProgress, saveInspection]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => sub.remove();
  }, [handleBackPress]);


  // ── Result handlers ──────────────────────────────────────
  const handleResult = useCallback((assetId: string, r: InspectionResult) => {
    setResults(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        result: r,
        defectReason: r !== InspectionResult.Fail ? '' : prev[assetId]?.defectReason ?? '',
      },
    }));
  }, []);

  const handleDefectChange = useCallback((assetId: string, reason: string) => {
    setResults(prev => ({ ...prev, [assetId]: { ...prev[assetId], defectReason: reason } }));
  }, []);

  // ── Add asset ────────────────────────────────────────────
  const handleAssetAdded = useCallback((newAssets: Asset[]) => {
    setAssets(prev => [...prev, ...newAssets]);
    setResults(prev => {
      const next = { ...prev };
      newAssets.forEach(a => { next[a.id] = initResult(); });
      return next;
    });
    Toast.show({
      type: 'success',
      text1: `${newAssets.length} Asset${newAssets.length > 1 ? 's' : ''} Added`,
      text2: 'Asset registered and ready to inspect.',
    });
  }, []);

  // ── Derived counts ───────────────────────────────────────
  const counts = useMemo(() => {
    const vals = Object.values(results);
    return {
      passed:    vals.filter(r => r.result === InspectionResult.Pass).length,
      failed:    vals.filter(r => r.result === InspectionResult.Fail).length,
      nt:        vals.filter(r => r.result === InspectionResult.NotTested).length,
      remaining: vals.filter(r => r.result === null).length,
      inspected: vals.filter(r => r.result !== null).length,
      total:     assets.length,
    };
  }, [results, assets]);

  const fillPct = counts.total > 0 ? (counts.inspected / counts.total) * 100 : 0;
  const allDone = counts.remaining === 0 && counts.total > 0;

  // ── Filtered list ────────────────────────────────────────
  const filtered = useMemo(() => {
    switch (filter) {
      case 'Passed':    return assets.filter(a => results[a.id]?.result === InspectionResult.Pass);
      case 'Failed':    return assets.filter(a => results[a.id]?.result === InspectionResult.Fail);
      case 'N/T':       return assets.filter(a => results[a.id]?.result === InspectionResult.NotTested);
      case 'Remaining': return assets.filter(a => !results[a.id] || results[a.id].result === null);
      default:          return assets;
    }
  }, [assets, results, filter]);

  // ── Complete & save ──────────────────────────────────────
  const handleComplete = () => {
    if (counts.inspected === 0) {
      Alert.alert('No Results', 'Please inspect at least one asset before completing.');
      return;
    }
    if (counts.remaining > 0) {
      Alert.alert(
        'Not All Inspected',
        `${counts.remaining} asset${counts.remaining !== 1 ? 's have' : ' has'} not been inspected.\n\nComplete anyway?`,
        [
          { text: 'Continue Inspecting', style: 'cancel' },
          { text: 'Complete', onPress: () => saveInspection() },
        ]
      );
    } else {
      saveInspection();
    }
  };

  const saveInspection = useCallback(async () => {
    if (!property || !user) return;
    setIsSaving(true);
    try {
      const now   = new Date().toISOString();
      const today = now.slice(0, 10);
      const jobId = generateUUID();

      // 1. Create completed job
      const jobPayload = {
        id: jobId, property_id: property.id, assigned_to: user.id,
        job_type: JobType.RoutineService, status: JobStatus.Completed,
        scheduled_date: today, scheduled_time: null, priority: Priority.Normal,
        notes: 'On-site inspection form submitted via SiteTrack mobile app.',
        created_at: now, updated_at: now,
      };
      upsertRecord('jobs', jobPayload as RecordData);
      addToSyncQueue('jobs', jobId, SyncOperation.Insert, jobPayload as RecordData);

      // 2. Save job_assets records
      // DECISION #2: assets the tech did not explicitly inspect are auto-marked
      // as not_tested. Never silently skip them — a missing record = missing compliance data.
      for (const asset of assets) {
        const r = results[asset.id];
        const resolvedResult = r?.result ?? InspectionResult.NotTested;
        const jaId = generateUUID();
        const jaPayload = {
          id: jaId, job_id: jobId, asset_id: asset.id,
          result: resolvedResult, checklist_data: null,
          is_compliant: resolvedResult === InspectionResult.Pass ? 1 : 0,
          defect_reason: resolvedResult === InspectionResult.Fail ? (r?.defectReason || null) : null,
          technician_notes: null, actioned_at: now,
        };
        upsertRecord('job_assets', jaPayload as RecordData);
        addToSyncQueue('job_assets', jaId, SyncOperation.Insert, jaPayload as RecordData);

        // 3. Auto-create defect if failed with reason
        if (resolvedResult === InspectionResult.Fail && r?.defectReason?.trim()) {
          const dId = generateUUID();
          const dPayload = {
            id: dId, job_id: jobId, asset_id: asset.id, property_id: property.id,
            description: r.defectReason.trim(), severity: DefectSeverity.Major,
            status: 'open', photos: '[]', created_at: now,
          };
          upsertRecord('defects', dPayload as RecordData);
          addToSyncQueue('defects', dId, SyncOperation.Insert, dPayload as RecordData);
        }
      }

      // 4. Update property compliance
      const compliance = counts.failed > 0 ? 'non_compliant' : 'compliant';
      upsertRecord('properties', { id: property.id, compliance_status: compliance, updated_at: now });
      addToSyncQueue('properties', property.id, SyncOperation.Update,
        { compliance_status: compliance, updated_at: now });

      Toast.show({
        type: 'success',
        text1: 'Inspection Saved',
        text2: 'Generating your report…',
      });
      router.replace(`/jobs/${jobId}/report` as never);
    } catch (err) {
      console.error('[SiteInspect] save error:', err);
      Toast.show({ type: 'error', text1: 'Save failed', text2: 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }, [property, user, assets, results, counts]);

  // ── Render item ──────────────────────────────────────────
  const renderItem = useCallback(({ item, index }: { item: Asset; index: number }) => (
    <AssetInspectCard
      asset={item}
      result={results[item.id] ?? initResult()}
      onResult={handleResult}
      onDefectChange={handleDefectChange}
      index={index}
    />
  ), [results, handleResult, handleDefectChange]);

  const filterOptions = [
    { label: 'All',       count: assets.length },
    { label: 'Remaining', count: counts.remaining },
    { label: 'Passed',    count: counts.passed },
    { label: 'Failed',    count: counts.failed },
    { label: 'N/T',       count: counts.nt },
  ];

  // ── Loading skeleton ─────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="On-Site Form" showBack />
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonBlock width="100%" height={130} borderRadius={16} />
          <SkeletonBlock width="100%" height={130} borderRadius={16} />
          <SkeletonBlock width="100%" height={130} borderRadius={16} />
        </View>
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={C.border} />
        <Text style={[s.emptyTitle, { color: C.text }]}>Property Not Found</Text>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: C.primary }]} onPress={() => router.back()}>
          <Text style={{ color: C.textOnPrimary, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Progress badge in header
  const progressBadge = (
    <View style={[s.progressBadge, {
      backgroundColor: allDone ? C.success + '30' : C.backgroundTertiary,
      borderColor: allDone ? C.success : 'transparent',
      borderWidth: allDone ? 1 : 0,
    }]}>
      <Text style={[s.progressBadgeTxt, { color: allDone ? C.success : C.textOnPrimary }]}>
        {allDone ? 'All Done ' : ''}{counts.inspected}/{counts.total}
      </Text>
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>

      {/* ── HEADER ──────────────────────────────────────── */}
      <ScreenHeader
        eyebrow="ON-SITE INSPECTION"
        title={property.name}
        subtitle={[property.address, property.suburb].filter(Boolean).join(', ') || 'No address'}
        showBack
        rightComponent={progressBadge}
      />

      {/* ── PROGRESS BAR ────────────────────────────────── */}
      <View style={[s.progressTrack, { backgroundColor: C.primary + '40' }]}>
        <View style={[s.progressFill, {
          backgroundColor: allDone ? C.success : C.accent,
          width: `${fillPct}%` as `${number}%`,
        }]} />
      </View>

      {/* ── STATS BAR ───────────────────────────────────── */}
      <View style={[s.statsBar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        {[
          { label: 'Passed',    value: counts.passed,    color: C.success },
          { label: 'Failed',    value: counts.failed,    color: C.error },
          { label: 'N/T',       value: counts.nt,        color: C.textTertiary },
          { label: 'Remaining', value: counts.remaining, color: C.accent },
        ].map((stat, i, arr) => (
          <React.Fragment key={stat.label}>
            <View style={s.statItem}>
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: C.textTertiary }]}>{stat.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={[s.statDivider, { backgroundColor: C.border }]} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── FILTER PILLS ────────────────────────────────── */}
      <View style={[s.filterRow, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <FilterPills
          options={filterOptions}
          activeIndex={filterOptions.findIndex(o => o.label === filter)}
          onSelect={i => setFilter(filterOptions[i].label)}
          variant="dark"
          style={{ flex: 1 }}
        />
      </View>

      {/* ── ASSET LIST / EMPTY STATE ─────────────────────── */}
      {assets.length === 0 ? (
        <View style={s.emptyState}>
          <MaterialCommunityIcons name="magnify" size={52} color={C.textTertiary} />
          <Text style={[s.emptyTitle, { color: C.text }]}>No Assets Registered</Text>
          <Text style={[s.emptySub, { color: C.textSecondary }]}>
            Tap below to add the first asset you find on-site.
          </Text>
          <TouchableOpacity
            style={[s.addFirstBtn, { backgroundColor: C.primary }]}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle" size={20} color={C.textOnPrimary} />
            <Text style={[s.addFirstBtnTxt, { color: C.textOnPrimary }]}>Add First Asset</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 130 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={6}
            maxToRenderPerBatch={6}
          />

          {/* ── FAB — Add Asset ──────────────────────────── */}
          <TouchableOpacity
            style={[s.fab, { backgroundColor: C.accent }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAddModal(true);
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus" size={22} color={C.textOnPrimary} />
            <Text style={[s.fabTxt, { color: C.textOnPrimary }]}>Add Asset</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── BOTTOM ACTION BAR ───────────────────────────── */}
      {assets.length > 0 && (
        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.bottomTitle, { color: C.text }]}>
              {allDone
                ? 'All assets inspected'
                : `${counts.remaining} asset${counts.remaining !== 1 ? 's' : ''} remaining`}
            </Text>
            <Text style={[s.bottomSub, { color: C.textSecondary }]}>
              {counts.inspected} of {counts.total} inspected
            </Text>
          </View>
          <Button
            title={isSaving ? 'Saving…' : 'Complete'}
            disabled={counts.inspected === 0 || isSaving}
            isLoading={isSaving}
            onPress={handleComplete}
            style={{ minWidth: 130, borderRadius: 22, height: 46 }}
          />
        </View>
      )}

      {/* ── MODALS ──────────────────────────────────────── */}
      <AddAssetModal
        visible={showAddModal}
        propertyId={property.id}
        onClose={() => setShowAddModal(false)}
        onAssetAdded={handleAssetAdded}
      />

      {/* Completion modal */}
      <Modal visible={showComplete} transparent animationType="fade" onRequestClose={() => setShowComplete(false)}>
        <View style={[cm.overlay, { backgroundColor: C.overlay }]}>
          <Animated.View entering={ZoomIn.duration(350)} style={[cm.card, { backgroundColor: C.surface, shadowColor: C.shadow }]}>
            <View style={[cm.circle, { backgroundColor: C.success }]}>
              <MaterialCommunityIcons name="check-bold" size={40} color={C.textOnPrimary} />
            </View>
            <Text style={[cm.title, { color: C.textOnPrimary }]}>Inspection Complete!</Text>
            <Text style={[cm.propName, { color: C.textSecondary }]}>{property.name}</Text>

            <View style={[cm.statsRow, { backgroundColor: C.backgroundTertiary }]}>
              {[
                { label: 'Passed', value: counts.passed },
                { label: 'Failed', value: counts.failed, alert: counts.failed > 0 },
                { label: 'Total',  value: counts.total },
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <View style={cm.statItem}>
                    <Text style={[cm.statValue, s.alert ? { color: C.errorLight } : { color: C.textOnPrimary }]}>{s.value}</Text>
                    <Text style={[cm.statLabel, { color: C.textSecondary }]}>{s.label}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={[cm.statDiv, { backgroundColor: C.border }]} />}
                </React.Fragment>
              ))}
            </View>

            {counts.failed > 0 && (
              <View style={[cm.alertRow, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                <MaterialCommunityIcons name="alert-circle" size={15} color={C.error} />
                <Text style={[cm.alertTxt, { color: C.errorDark }]}>
                  {counts.failed} defect{counts.failed !== 1 ? 's' : ''} logged — follow up with your office.
                </Text>
              </View>
            )}

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                style={[cm.btn, { backgroundColor: C.success }]}
                onPress={() => { setShowComplete(false); router.back(); }}
              >
                <MaterialCommunityIcons name="arrow-left-circle" size={18} color={C.textOnPrimary} />
                <Text style={[cm.btnTxt, { color: C.textOnPrimary }]}>Return to Property</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cm.btn, { backgroundColor: C.backgroundTertiary }]}
                onPress={() => { setShowComplete(false); router.dismissAll(); }}
              >
                <Text style={[cm.btnTxt, { color: C.textOnPrimary }]}>Go to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
```

*Size: **785** lines of code.*

---

## 📄 `app/(app)/properties/site-inspect/_layout.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function SiteInspectLayout`
```tsx
export default function SiteInspectLayout() {
  return <Slot />;
}
```

*Size: **8** lines of code.*

---

## 📄 `app/(app)/properties/[id].tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function PropertyDetailScreen`
```tsx
export default function PropertyDetailScreen() {
  const C = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [assets, setAssets]     = useState<Asset[]>([]);
  const [jobHistory, setJobHistory] = useState<JobHistory[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  const load = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    try {
      const p = getRecord<Property>('properties', id);
      setProperty(p);
      if (p) {
        setAssets(getAssetsForProperty<Asset>(id));
        // M2: Fetch all jobs (no limit) so the count badge reflects reality
        setJobHistory(getJobsForProperty<JobHistory>(id));
      }
    } catch (err) {
      console.error('[PropertyDetail] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (isLoading) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="Not Found" showBack={true} />
        <EmptyState
          icon="office-building-marker-outline"
          title="Property not found"
          subtitle="We couldn't locate the property record."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const COMPLIANCE_CONFIG = getComplianceConfig(C);
  const compliance = COMPLIANCE_CONFIG[property.compliance_status as ComplianceStatus]
    ?? COMPLIANCE_CONFIG[ComplianceStatus.Pending];

  const today         = new Date().toISOString().slice(0, 10);
  const activeAssets  = assets.filter(a => a.status === AssetStatus.Active).length;
  const isOverdue     = property.next_inspection_date && property.next_inspection_date < today;
  const passedJobs    = jobHistory.filter(j => j.status === JobStatus.Completed).length;

  const fullAddress = [property.address, property.suburb, property.state, property.postcode]
    .filter(Boolean).join(', ');

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── HERO HEADER ────────────────────────────────── */}
        <ScreenHeader
          eyebrow="PROPERTY RECORD"
          title={property.name}
          subtitle={fullAddress || 'No address on file'}
          showBack={true}
          rightComponent={
            <View style={[s.compliancePill, { backgroundColor: compliance.badge + '30', borderColor: compliance.badge, borderWidth: 1 }]}>
              <MaterialCommunityIcons name={compliance.icon} size={12} color={compliance.badge} />
              <Text style={[s.compliancePillTxt, { color: compliance.badge }]}>
                {compliance.label.toUpperCase()}
              </Text>
            </View>
          }
        />

        {/* ── COMPLIANCE BANNER ──────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)}>
          <View style={[s.complianceBanner, { backgroundColor: compliance.bg, borderColor: compliance.border, marginHorizontal: 16, marginTop: 16 }]}>
            <View style={[s.complianceBannerIcon, { backgroundColor: compliance.border + '25' }]}>
              <MaterialCommunityIcons name={compliance.icon} size={26} color={compliance.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.complianceBannerTitle, { color: compliance.text }]}>
                {compliance.label}
              </Text>
              <Text style={[s.complianceBannerSub, { color: compliance.subtext }]}>
                {property.compliance_status === ComplianceStatus.Compliant
                  ? 'All assets are within service schedule.'
                  : property.compliance_status === ComplianceStatus.Overdue
                  ? `Inspection is overdue. Next inspection was due ${property.next_inspection_date}.`
                  : property.compliance_status === ComplianceStatus.NonCompliant
                  ? 'Outstanding defects or failed inspections on file.'
                  : 'Awaiting initial inspection or compliance review.'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── QUICK STATS ROW ────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.statsRow}>
          <StatPill
            icon="shield-check"
            value={activeAssets}
            label="ASSETS"
            color={C.primary}
            bg={C.primary + '12'}
          />
          <StatPill
            icon="calendar-clock"
            value={isOverdue ? 'YES' : 'NO'}
            label="OVERDUE"
            color={isOverdue ? C.error : C.textTertiary}
            bg={isOverdue ? C.errorLight : C.backgroundTertiary}
          />
          <StatPill
            icon="check-circle"
            value={passedJobs}
            label="JOBS DONE"
            color={C.success}
            bg={C.successLight}
          />
        </Animated.View>

        {/* ── BEGIN INSPECTION CTA removed — inspection is always job-scoped.
             Technicians start inspections from /jobs/[id]/inspect. */}


        {/* ── QUICK ACTIONS ──────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(130).duration(400)} style={s.actionRowWrap}>
          {property.site_contact_phone && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={() => Linking.openURL(`tel:${property.site_contact_phone}`)}
              activeOpacity={0.75}
            >
              <View style={[s.actionBtnIcon, { backgroundColor: C.primary + '15' }]}>
                <MaterialCommunityIcons name="phone" size={18} color={C.primary} />
              </View>
              <Text style={[s.actionBtnLabel, { color: C.text }]}>Call Contact</Text>
            </TouchableOpacity>
          )}
          {property.address && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`)}
              activeOpacity={0.75}
            >
              <View style={[s.actionBtnIcon, { backgroundColor: C.accent + '15' }]}>
                <MaterialCommunityIcons name="directions" size={18} color={C.accent} />
              </View>
              <Text style={[s.actionBtnLabel, { color: C.text }]}>Navigate</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── SAFETY ALERTS ──────────────────────────────── */}
        {(property.hazard_notes || property.access_notes || property.site_note) && (
          <Animated.View entering={FadeInDown.delay(160).duration(400)} style={{ marginHorizontal: 16, gap: 10, marginTop: 8 }}>
            {property.hazard_notes && (
              <View style={[s.alertCard, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                <View style={[s.alertIconWrap, { backgroundColor: C.error }]}>
                  <MaterialCommunityIcons name="alert" size={16} color={C.textOnPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: C.errorDark }]}>Site Hazard Warning</Text>
                  <Text style={[s.alertBody, { color: C.error }]}>{property.hazard_notes}</Text>
                </View>
              </View>
            )}
            {property.access_notes && (
              <View style={[s.alertCard, { backgroundColor: C.infoLight, borderColor: C.infoDark }]}>
                <View style={[s.alertIconWrap, { backgroundColor: C.infoDark }]}>
                  <MaterialCommunityIcons name="key-variant" size={16} color={C.textOnPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: C.infoDark }]}>Access Instructions</Text>
                  <Text style={[s.alertBody, { color: C.infoDark }]}>{property.access_notes}</Text>
                </View>
              </View>
            )}
            {property.site_note && (
              <View style={[s.alertCard, { backgroundColor: C.successLight, borderColor: C.success }]}>
                <View style={[s.alertIconWrap, { backgroundColor: C.success }]}>
                  <MaterialCommunityIcons name="note-text-outline" size={16} color={C.textOnPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: C.successDark }]}>Site Note</Text>
                  <Text style={[s.alertBody, { color: C.successDark }]}>{property.site_note}</Text>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── PROPERTY INFO CARD ──────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <SectionHeader icon="information-outline" title="Site Details" />
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border, marginHorizontal: 16 }]}>
            <InfoRow
              icon="map-marker-outline"
              label="Address"
              value={fullAddress || 'Not specified'}
            />
            {property.site_contact_name && (
              <>
                <View style={[s.divider, { backgroundColor: C.border }]} />
                <InfoRow
                  icon="account-tie-outline"
                  label="Site Contact"
                  value={property.site_contact_name}
                />
              </>
            )}
            {property.site_contact_phone && (
              <>
                <View style={[s.divider, { backgroundColor: C.border }]} />
                <InfoRow
                  icon="phone-outline"
                  label="Phone"
                  value={property.site_contact_phone}
                  valueColor={C.primary}
                  onPress={() => Linking.openURL(`tel:${property.site_contact_phone}`)}
                />
              </>
            )}
          </View>
        </Animated.View>

        {/* ── ASSET SUMMARY ──────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <SectionHeader
            icon="shield-outline"
            title="Asset Register"
            count={assets.length}
            actionLabel="View All →"
            onAction={() => router.push(`/properties/assets/${id}` as never)}
          />
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border, marginHorizontal: 16 }]}>
            <InfoRow
              icon="shield-check-outline"
              label="Total Assets"
              value={assets.length.toString()}
              onPress={() => router.push(`/properties/assets/${id}` as never)}
            />
            {property.next_inspection_date && (
              <>
                <View style={[s.divider, { backgroundColor: C.border }]} />
                <InfoRow
                  icon="calendar-clock-outline"
                  label="Next Inspection"
                  value={property.next_inspection_date}
                  valueColor={isOverdue ? C.error : C.text}
                />
              </>
            )}
            {activeAssets > 0 && !isOverdue && (
              <>
                <View style={[s.divider, { backgroundColor: C.border }]} />
                <View style={[s.assetRow, { justifyContent: 'center' }]}>
                  <MaterialCommunityIcons name="check-decagram" size={16} color={C.success} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.success, marginLeft: 6 }}>Site is up to date</Text>
                </View>
              </>
            )}
          </View>
        </Animated.View>

        {/* ── JOB HISTORY ─────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(280).duration(400)}>
          <SectionHeader
            icon="clipboard-list-outline"
            title="Job History"
            count={jobHistory.length}
          />
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border, marginHorizontal: 16, padding: 0 }]}>
            {jobHistory.length === 0 ? (
              <View style={s.emptyInCard}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={C.border} />
                <Text style={[s.emptyTitle, { color: C.textTertiary }]}>No previous jobs</Text>
                <Text style={[s.emptySub, { color: C.textTertiary }]}>This property has no job history yet.</Text>
              </View>
            ) : (
              // M2: Show first 5, then a "View all" footer
              <>
                {jobHistory.slice(0, 5).map((job, i) => (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      s.historyRow,
                      i < Math.min(jobHistory.length, 5) - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                    ]}
                    onPress={() => router.push(`/jobs/${job.id}` as never)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.historyIconWrap, { backgroundColor: C.backgroundTertiary }]}>
                      <MaterialCommunityIcons name="clipboard-check-outline" size={18} color={C.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.historyDate, { color: C.text }]}>
                        {job.scheduled_date}
                        {(job.status === JobStatus.Completed || job.status === JobStatus.InProgress) && job.updated_at 
                          ? ` → ${job.updated_at.substring(0, 10)}` 
                          : ''}
                      </Text>
                      <JobTypeBadge jobType={job.job_type as JobType} />
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <StatusBadge status={job.status as JobStatus} small />
                      <MaterialCommunityIcons name="chevron-right" size={16} color={C.border} />
                    </View>
                  </TouchableOpacity>
                ))}
                {jobHistory.length > 5 && (
                  <View style={[s.historyRow, { justifyContent: 'center', borderTopWidth: 1, borderTopColor: C.border }]}>
                    <Text style={[s.historyDate, { color: C.textTertiary, fontSize: 12, fontWeight: '600' }]}>
                      + {jobHistory.length - 5} more job{jobHistory.length - 5 !== 1 ? 's' : ''} on record
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </Animated.View>

      </ScrollView>

      {/* Add Asset Modal has been moved to the dedicated assets sub-page */}
    </View>
  );
}
```

*Size: **536** lines of code.*

---

## 📄 `app/(app)/properties/_layout.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function PropertiesLayout`
```tsx
export default function PropertiesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
```

*Size: **9** lines of code.*

---

## 📄 `app/(app)/_layout.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function AppLayout`
```tsx
export default function AppLayout() {
  const C = useColors();
  const { isAuthenticated, user, isForceSyncing } = useAuthStore();
  const { subscribeToSync: jobsSubscribe, unsubscribeFromSync: jobsUnsub } = useJobsStore();
  const { subscribeToSync: dashSubscribe, unsubscribeFromSync: dashUnsub } = useDashboardStore();

  // Throttle the heartbeat access check to once per 5 minutes.
  // Checking on every segment change causes up to 10+ Supabase calls/min during normal navigation.
  const lastHeartbeatRef = useRef<number>(0);
  const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  const segments = useSegments();
  
  // Only show the tab bar on the three main screens. All detail routes hide it.
  const segs = segments as string[];
  const isMainTab = 
    (segs.length === 1 && segs[0] === '(app)') ||
    (segs.length === 2 && ['index', 'jobs', 'profile'].includes(segs[1])) ||
    (segs.length === 3 && ['index', 'jobs', 'profile'].includes(segs[1]) && segs[2] === 'index');
    
  const hideTabBar = !isMainTab;

  // Always mount the network listener at the root so it fires on ALL tabs
  useNetworkStatus();

  // Heartbeat access check: re-validates account on navigation but at most once per 5 minutes.
  // Catches admin deactivation without waiting for the next 60s sync cycle.
  useEffect(() => {
    if (!user?.id) return;
    const now = Date.now();
    if (now - lastHeartbeatRef.current < HEARTBEAT_INTERVAL_MS) return;
    lastHeartbeatRef.current = now;

    supabase
      .from('users')
      .select('is_active, company_id')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        if (data.is_active === false) {
          console.warn('[AppLayout] User deactivated. Forcing graceful logout.');
          useAuthStore.getState().forceFinalSyncAndSignOut();
          return;
        }
        if (data.company_id) {
          supabase
            .from('companies')
            .select('subscription_status')
            .eq('id', data.company_id)
            .single()
            .then(({ data: company }) => {
              if (company?.subscription_status === 'suspended' || company?.subscription_status === 'cancelled') {
                console.warn('[AppLayout] Company suspended. Forcing graceful logout.');
                useAuthStore.getState().forceFinalSyncAndSignOut();
              }
            });
        }
      });
  }, [segments, user?.id, HEARTBEAT_INTERVAL_MS]);

  // Start background sync interval on mount (runs immediately + every 60s)
  // NOTE: startSync() is intentionally called AFTER the stores subscribe
  // to sync-complete events (below), so the first sync always triggers a UI reload.

  // When user logs in / session restores:
  //  1. Subscribe stores to auto-reload on every future sync
  //  2. Eagerly load from SQLite cache so the UI isn't blank
  //  3. Start the sync loop (runs immediately + every 60s)
  //     The loop is started AFTER subscribing so the first sync-complete fires correctly
  const { loadJobs } = useJobsStore();
  const { loadDashboard } = useDashboardStore();
  const { load: loadCatalogue, subscribeToSync: catSubscribe, unsubscribeFromSync: catUnsub } = useCatalogueStore();

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to future sync completions first
    jobsSubscribe(user.id);
    dashSubscribe(user.id);
    catSubscribe(); // A8: refresh catalogue after every sync

    // Load whatever is already in the local SQLite cache immediately
    loadJobs(user.id);
    loadDashboard(user.id);
    loadCatalogue();

    // Now start the background sync loop
    startSync(user.id);

    return () => {
      jobsUnsub();
      dashUnsub();
      catUnsub();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
        tabBarStyle: hideTabBar ? { display: 'none' } : {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          borderTopWidth: 1,
          elevation: 0,
          shadowColor: C.shadow,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.10,
          shadowRadius: 16,
          height: Platform.OS === 'ios' ? 82 : 72,
          paddingBottom: Platform.OS === 'ios' ? 22 : 12,
          paddingTop: 2,
        },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.tabIconDefault,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
      }}
    >
      {/* ── The 3 real tabs ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="view-dashboard-outline"
              name_active="view-dashboard"
              color={color}
              size={size}
              focused={focused}
              label="Home"
              activeColor={C.accent}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="briefcase-check-outline"
              name_active="briefcase-check"
              color={color}
              size={size}
              focused={focused}
              label="Schedule"
              activeColor={C.accent}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="account-circle-outline"
              name_active="account-circle"
              color={color}
              size={size}
              focused={focused}
              label="Profile"
              activeColor={C.accent}
            />
          ),
        }}
      />

      {/* ── Hidden routes (no tab bar entry) ── */}
      <Tabs.Screen name="notifications/index" options={{ href: null }} />
      <Tabs.Screen name="properties" options={{ href: null }} />
      <Tabs.Screen name="assets" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="defects/index" options={{ href: null }} />
    </Tabs>

    {isForceSyncing && (
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.overlayBg} />
        <View style={styles.overlayContent}>
          <ActivityIndicator size="large" color={C.accent} style={{ marginBottom: 20 }} />
          <Text style={styles.overlayTitle}>Account Deactivated</Text>
          <Text style={styles.overlayText}>
            Please wait while your final offline changes are securely synced to the server before logout...
          </Text>
        </View>
      </View>
    )}
    </>
  );
}
```

*Size: **299** lines of code.*

---

## 📄 `app/(auth)/forgot-password.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function ForgotPasswordScreen`
```tsx
export default function ForgotPasswordScreen() {
  const [email, setEmail]         = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner]       = useState<BannerState>(null);
  const C = useColors();

  const validate = (): boolean => {
    if (!email.trim()) {
      setEmailError('Email is required.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSendReset = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setBanner(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
      );
      if (error) {
        setBanner({ type: 'error', message: error.message });
      } else {
        setBanner({
          type: 'success',
          message: 'Check your inbox — a password reset link has been sent.',
        });
      }
    } catch {
      setBanner({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Navy Hero Header ──────────── */}
        <View style={[styles.heroSection, { backgroundColor: C.primary }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Reset Password</Text>
          <Text style={styles.heroSub}>Enter your email to receive a reset link</Text>
        </View>

        {/* ── Form Card ─────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Card style={[styles.formCard]}>

          {/* Success state replaces form */}
          {banner?.type === 'success' ? (
            <View style={styles.successCard}>
              <View style={[styles.successIcon, { backgroundColor: C.success }]}>
                <MaterialCommunityIcons name="check-circle" size={36} color="#FFFFFF" />
              </View>
              <Text style={[styles.successTitle, { color: C.text }]}>Email Sent!</Text>
              <Text style={[styles.successBody, { color: C.textSecondary }]}>{banner.message}</Text>
              <Button style={{ marginTop: 12, width: '100%' }} variant="secondary" title="Back to Login" onPress={() => router.back()} />
            </View>
          ) : (
            <>
              {/* Error banner */}
              {banner?.type === 'error' ? (
                <View style={[styles.errorBanner, { backgroundColor: C.errorLight }]}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color={C.errorDark} />
                  <Text style={[styles.errorBannerText, { color: C.errorDark }]}>{banner.message}</Text>
                </View>
              ) : null}

              {/* Email field */}
              <Input
                label="EMAIL ADDRESS"
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                placeholder="you@company.com.au"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                maxLength={254}
                error={emailError}
                leftIcon={<MaterialCommunityIcons name="email-outline" size={18} color={C.textSecondary} />}
                style={{ marginBottom: 20 }}
              />

              {/* Send button */}
              <Button title="Send Reset Email" variant="secondary" onPress={handleSendReset} isLoading={isLoading} />
            </>
          )}
          </Card>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

*Size: **225** lines of code.*

---

## 📄 `app/(auth)/index.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function SplashScreen`
```tsx
export default function SplashScreen() {
  const { isLoading, isAuthenticated } = useAuthStore();
  const C = useColors();

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(app)/');
      } else {
        router.replace('/(auth)/login');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated]);

  return (
    <View style={[styles.container, { backgroundColor: C.primary }]}>
      {/* ── Logo ─────────────────── */}
      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        {/* Outer translucent ring */}
        <View style={styles.logoOuter}>
          {/* Inner solid circle */}
          <View style={[styles.logoInner, { backgroundColor: C.accent, shadowColor: C.accent }]}>
            <Text style={styles.logoLetters}>ST</Text>
          </View>
        </View>

        {/* App name */}
        <Text style={styles.appName}>{APP_NAME}</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>Field Service, Simplified</Text>
      </Animated.View>

      {/* ── Loading indicator ─────── */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.footer}>
        <ActivityIndicator size="small" color={C.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </Animated.View>
    </View>
  );
}
```

*Size: **116** lines of code.*

---

## 📄 `app/(auth)/login.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function LoginScreen`
```tsx
export default function LoginScreen() {
  const { signIn, isLoading, error, clearError } = useAuth();
  const { restoreSession } = useAuthStore();
  const C = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const { isOnline } = useNetworkStatus();

  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [showPassword, setShowPassword]     = useState(false);
  const [rememberMe, setRememberMe]         = useState(false);
  const [emailError, setEmailError]         = useState('');
  const [passwordError, setPasswordError]   = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricType, setBiometricType]   = useState<'fingerprint' | 'face' | null>(null);

  // Adjust scroll when keyboard opens so inputs remain visible
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollTo({ y: 150, animated: true });
    });
    return () => show.remove();
  }, []);

  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const [compatible, enrolled, remembered] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          AsyncStorage.getItem(REMEMBER_ME_KEY),
        ]);
        if (compatible && enrolled && remembered === 'true') {
          setBiometricsAvailable(true);
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          setBiometricType(
            types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
              ? 'face' : 'fingerprint'
          );
        }
      } catch { /* silently skip */ }
    };
    checkBiometrics();
  }, []);

  const validate = (): boolean => {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    if (!email.trim()) { setEmailError('Email is required.'); valid = false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Enter a valid email address.'); valid = false; }
    if (!password) { setPasswordError('Password is required.'); valid = false; }
    else if (password.length < 6) { setPasswordError('Password must be at least 6 characters.'); valid = false; }
    return valid;
  };

  const handleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearError();
    // Normalise email before validation: trim whitespace and lowercase.
    // Trailing spaces cause silent auth failures (Supabase treats them as different addresses).
    const normalisedEmail = email.trim().toLowerCase();
    setEmail(normalisedEmail);
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await signIn(normalisedEmail, password, rememberMe);
  };

  const handleBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to SiteTrack',
        cancelLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      if (result.success) {
        await restoreSession();
      }
    } catch (err) { console.warn('[Login] Biometric error:', err); }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.content}>
          {/* ── Brand Logo ────── */}
          <Animated.View entering={FadeIn.delay(100).duration(600)} style={styles.logoContainer}>
            <View style={[styles.logoBox, { backgroundColor: C.surface, borderColor: C.border }]}>
              <MaterialCommunityIcons name="shield-check" size={42} color={C.primary} />
            </View>
            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <Text style={[styles.brandName, { color: C.text }]}>SiteTrack</Text>
              <Text style={[styles.brandTagline, { color: C.textSecondary }]}>Enter your credentials to continue</Text>
            </Animated.View>
          </Animated.View>

          {/* ── Form Section ─────────────── */}
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.formContainer}>
            {!isOnline && (
              <View style={[styles.alertBanner, { backgroundColor: C.warningLight, borderColor: C.warning + '40' }]}>
                <MaterialCommunityIcons name="wifi-off" size={18} color={C.warning} />
                <Text style={[styles.alertText, { color: C.warningDark }]}>
                  You are offline. Biometric sign-in still works. Signing in with a password requires internet.
                </Text>
              </View>
            )}

            {error && (
              <View style={[styles.alertBanner, { backgroundColor: C.errorLight, borderColor: C.error + '40' }]}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={C.error} />
                <Text style={[styles.alertText, { color: C.error }]}>{error}</Text>
              </View>
            )}

            <Input
              label="Email"
              value={email}
              onChangeText={(t) => { setEmail(t); setEmailError(''); }}
              placeholder="you@company.com.au"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={MAX_LENGTHS.email}
              error={emailError}
              leftIcon={<MaterialCommunityIcons name="email-outline" size={18} color={C.textTertiary} />}
              style={{ marginBottom: 16 }}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              maxLength={128}
              error={passwordError}
              leftIcon={<MaterialCommunityIcons name="lock-outline" size={18} color={C.textTertiary} />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={C.textTertiary}
                  />
                </TouchableOpacity>
              }
              style={{ marginBottom: 12 }}
            />

            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberLeft}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRememberMe(v => !v); }}
                activeOpacity={0.7}
              >
                <Checkbox
                  status={rememberMe ? 'checked' : 'unchecked'}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRememberMe(v => !v); }}
                  color={C.primary}
                />
                <Text style={[styles.rememberLabel, { color: C.text }]}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={[styles.forgotLink, { color: C.primary }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <Button
              title="Sign In"
              onPress={handleSignIn}
              isLoading={isLoading}
              style={{ height: 52, borderRadius: 12, marginTop: 8 }}
            />

            {biometricsAvailable && (
              <>
                <View style={styles.dividerRow}>
                  <View style={[styles.divider, { backgroundColor: C.border }]} />
                  <Text style={[styles.dividerTxt, { color: C.textTertiary }]}>or</Text>
                  <View style={[styles.divider, { backgroundColor: C.border }]} />
                </View>
                <Button
                  title={biometricType === 'face' ? 'Sign in with Face ID' : 'Sign in with Fingerprint'}
                  variant="secondary"
                  onPress={handleBiometric}
                  icon={
                    <MaterialCommunityIcons
                      name={biometricType === 'face' ? 'face-recognition' : 'fingerprint'}
                      size={20}
                      color={C.primary}
                    />
                  }
                  style={{ height: 52, borderRadius: 12 }}
                />
              </>
            )}
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerTxt, { color: C.textTertiary }]}>© 2026 SiteTrack · Field Service Platform</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

*Size: **350** lines of code.*

---

## 📄 `app/(auth)/_layout.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function AuthLayout`
```tsx
export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  // Already logged in — go straight to the app
  if (isAuthenticated) {
    return <Redirect href="/(app)/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
```

*Size: **21** lines of code.*

---

## 📄 `app/_layout.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. **We expect this to render UI and handle user interactions for a specific route.**

### Core Code Logic & Implementations:

#### `default function RootLayout`
```tsx
export default function RootLayout() {
  const { isLoading, restoreSession } = useAuthStore();

  // ── Screenshot / Screen-capture prevention ─────────────────────────────────
  // Android: FLAG_SECURE is set natively in MainActivity.kt (blocks at OS level)
  // iOS + JS layer: expo-screen-capture blocks screen recording
  // iOS app-switcher: AppState blur overlay hides content when app backgrounds
  const [isObscured, setIsObscured] = useState(false);
  const obscureOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // TODO (PRE-RELEASE): Re-enable screen capture prevention before production build.
    // Disabled temporarily for UI screenshots and design review only.
    // ScreenCapture.preventScreenCaptureAsync();
    return () => {
      // ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // On iOS, show a solid overlay when the app goes to background so the OS
    // cannot capture a screenshot of sensitive content in the app switcher.
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'inactive' || nextState === 'background') {
        setIsObscured(true);
        Animated.timing(obscureOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
      } else {
        Animated.timing(obscureOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
          setIsObscured(false)
        );
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [obscureOpacity]);
  // ──────────────────────────────────────────────────────────────────────────

  // 1. Initialise local SQLite then restore session — MUST be sequential.
  //    On a fresh install, restoreSession() can trigger loadJobs() → SQLite queries
  //    before the schema tables exist if both effects run in parallel (CRIT-3 race condition).
  useEffect(() => {
    (async () => {
      try {
        initializeSchema();
        cleanOldSyncQueueItems();
        // Give any permanently-failed sync items a fresh retry budget on startup.
        // Better than clearing them — data that failed due to a transient issue
        // (RLS policy lag, momentary offline) gets another chance to reach the server.
        resetStaleFailedSyncItems();
      } catch (e) {
        console.error('[DB] Schema init error:', e);
      }
      // Session restore MUST come after schema is ready
      await restoreSession();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Configure notification handler + request permission
  useEffect(() => {
    configureNotificationHandler();
    requestNotificationPermission();
  }, []);

  // Hide splash once loading is complete. MUST be above the conditional early-return
  // so React Hooks are always called in the same order (rules-of-hooks).
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // Always dark — field service app.
  const theme = paperDarkTheme;

  // Show a blank loading screen while session is being restored.
  if (isLoading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <View style={[styles.container, { backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator color={theme.colors.secondary} size="large" />
            </View>
            <StatusBar style="light" />
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <Slot />
          <StatusBar style="light" />
          <Toast />
          {/* iOS app-switcher screenshot shield */}
          {isObscured && (
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                styles.screenshotShield,
                { opacity: obscureOpacity },
              ]}
              pointerEvents="none"
            />
          )}
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

#### `function ErrorBoundary`
```tsx
export function ErrorBoundary({ error, retry }
```

*Size: **177** lines of code.*

---

# 📁 `components/` Directory

## 📄 `components/camera/index.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
export { default as PhotoCaptureSheet } from './PhotoCaptureSheet';
export { default as PhotoGrid } from './PhotoGrid';
```

*Size: **3** lines of code.*

---

## 📄 `components/camera/PhotoCaptureSheet.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `type PhotoCaptureSheetRef`
```tsx
export interface PhotoCaptureSheetRef {
  open: () => void;
  close: () => void;
}
```

*Size: **293** lines of code.*

---

## 📄 `components/camera/PhotoGrid.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `default function PhotoGrid`
```tsx
export default function PhotoGrid({ photos, onPhotoLongPress }
```

*Size: **141** lines of code.*

---

## 📄 `components/defects/AddDefectSheet.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `type AddDefectSheetRef`
```tsx
export interface AddDefectSheetRef { open: () => void; close: () => void; }
```

*Size: **521** lines of code.*

---

## 📄 `components/defects/DefectCard.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `default function DefectCard`
```tsx
export default function DefectCard({ defect, onPress, onEdit }
```

*Size: **206** lines of code.*

---

## 📄 `components/defects/DefectCodePicker.tsx`

> **Description:** DefectCodePicker.tsx — Searchable Uptick-style defect code picker Matches the UI from Uptick Image 6: - Search bar filters codes + descriptions in real-time - "Custom Note" always at top - Code bold + description grey + price badge (green) - Category grouping with icons
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `default function DefectCodePicker`
```tsx
export default function DefectCodePicker({ visible, onSelect, onClose }
```

*Size: **438** lines of code.*

---

## 📄 `components/defects/index.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
export { default as AddDefectSheet } from './AddDefectSheet';
export { default as DefectCard } from './DefectCard';
export { default as DefectCodePicker } from './DefectCodePicker';
```

*Size: **4** lines of code.*

---

## 📄 `components/inspections/AddAssetModal.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `default function AddAssetModal`
```tsx
export default function AddAssetModal({ visible, propertyId, onClose, onAssetAdded }
```

*Size: **566** lines of code.*

---

## 📄 `components/inspections/AssetInspectModal.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `default function AssetInspectModal`
```tsx
export default function AssetInspectModal({ visible, asset, jobId, onClose, onSaveFail }
```

*Size: **553** lines of code.*

---

## 📄 `components/inspections/ChecklistModal.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `default function ChecklistModal`
```tsx
export default function ChecklistModal({
  visible, assetType, items, initialData, onSave, onCancel,
}
```

*Size: **282** lines of code.*

---

## 📄 `components/inspections/EditAssetModal.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `default function EditAssetModal`
```tsx
export default function EditAssetModal({ visible, asset, onClose, onAssetEdited }
```

*Size: **215** lines of code.*

---

## 📄 `components/inspections/index.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
export { default as AddAssetModal } from './AddAssetModal';
export { default as AssetInspectModal } from './AssetInspectModal';
export { default as ChecklistModal } from './ChecklistModal';
```

*Size: **4** lines of code.*

---

## 📄 `components/jobs/CompletionBottomSheet.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `default function CompletionBottomSheet`
```tsx
export default function CompletionBottomSheet({ 
  visible, onClose, onConfirm, assetsTotal, assetsInspected, hasSignature, hasDefects, onNeedSignature 
}
```

*Size: **110** lines of code.*

---

## 📄 `components/jobs/index.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
// Mixed exports — some components use default, others use named exports
export { default as CompletionBottomSheet } from './CompletionBottomSheet';
export { JobCard } from './JobCard';
export { JobTypeBadge } from './JobTypeBadge';
export { default as RouteMapView } from './RouteMapView';
export { SignatureModal } from './SignatureModal';
export { StatusBadge } from './StatusBadge';
```

*Size: **8** lines of code.*

---

## 📄 `components/jobs/JobCard.tsx`

> **Description:** JobCard — professional enterprise card with priority strip, status badge, and swipe actions. Clean, data-rich layout with strong typography and clear visual hierarchy.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `const JobCard`
```tsx
export const JobCard = React.memo(function JobCard({
  job, onPress, showNavigate = false, swipeable = false, onStart, onCancel,
}
```

*Size: **250** lines of code.*

---

## 📄 `components/jobs/JobTypeBadge.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function JobTypeBadge`
```tsx
export function JobTypeBadge({ jobType }
```

*Size: **41** lines of code.*

---

## 📄 `components/jobs/RouteMapView.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `default function RouteMapView`
```tsx
export default function RouteMapView({ jobs, onJobSelect }
```

*Size: **269** lines of code.*

---

## 📄 `components/jobs/RouteMapView.web.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `default function RouteMapView`
```tsx
export default function RouteMapView() {
  return (
    <View style={s.wrap}>
      <Text style={s.text}>Map not available on web</Text>
    </View>
  );
}
```

*Size: **19** lines of code.*

---

## 📄 `components/jobs/SignatureModal.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function SignatureModal`
```tsx
export function SignatureModal({ visible, onClose, onSign, clientName }
```

*Size: **121** lines of code.*

---

## 📄 `components/jobs/StatusBadge.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function StatusBadge`
```tsx
export function StatusBadge({ status, small = false }
```

*Size: **76** lines of code.*

---

## 📄 `components/OfflineBanner.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function OfflineBanner`
```tsx
export function OfflineBanner() {
  const C = useColors();
  const { isOnline } = useNetworkStatus();
  const [bannerState, setBannerState] = useState<BannerState>('hidden');
  const [pendingCount, setPendingCount] = useState(0);
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const prevOnlineRef = useRef<boolean | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Poll pending count when offline ──────────────────
  useEffect(() => {
    if (!isOnline) {
      const update = () => {
        try { setPendingCount(getPendingSyncItems().length); } catch { /* ignore */ }
      };
      update();
      const interval = setInterval(update, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isOnline]);

  // ── State machine ─────────────────────────────────────
  useEffect(() => {
    const wasOnline = prevOnlineRef.current;

    if (!isOnline) {
      // Going offline
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setBannerState('offline');
    } else if (wasOnline === false) {
      // Reconnected — show "Syncing..." briefly
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setBannerState('syncing');
      // After 2.5s move to "Synced" state
      hideTimerRef.current = setTimeout(() => {
        setBannerState('synced');
        // Auto-dismiss synced banner after 3s
        hideTimerRef.current = setTimeout(() => {
          setBannerState('hidden');
        }, 3000);
      }, 2500);
    } else if (wasOnline === null) {
      // First mount — online from start
      setBannerState('hidden');
    }

    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  // ── Animate up/down ────────────────────────────────
  useEffect(() => {
    const show = bannerState !== 'hidden';
    Animated.timing(translateY, {
      toValue: show ? 0 : -BANNER_HEIGHT,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [bannerState, translateY]);

  // ── Config per state ──────────────────────────────────
  const stateConfig = {
    offline: {
      bg:   T.warningBg,
      icon: 'wifi-off' as const,
      text: pendingCount > 0
        ? `⚠️  Offline — ${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync`
        : '⚠️  Offline Mode — changes save locally',
      textColor: T.warning,
    },
    syncing: {
      bg:   C.primary,
      icon: 'sync' as const,
      text: '🔄  Syncing changes with cloud...',
      textColor: '#FFFFFF',
    },
    synced: {
      bg:   C.success,
      icon: 'cloud-check-outline' as const,
      text: '✅  All changes synced successfully',
      textColor: '#FFFFFF',
    },
    hidden: {
      bg:   'transparent',
      icon: 'wifi-off' as const,
      text: '',
      textColor: '#000',
    },
  };

  const cfg = stateConfig[bannerState] ?? stateConfig.hidden;

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: cfg.bg, transform: [{ translateY }] },
      ]}
    >
      <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.textColor} />
      <Text style={[styles.text, { color: cfg.textColor }]} numberOfLines={1}>
        {cfg.text}
      </Text>
      {bannerState === 'synced' && (
        <TouchableOpacity onPress={() => setBannerState('hidden')} hitSlop={10}>
          <MaterialCommunityIcons name="close" size={14} color={cfg.textColor} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
```

*Size: **148** lines of code.*

---

## 📄 `components/SyncStatusBar.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function SyncStatusBar`
```tsx
export function SyncStatusBar({ light = false }
```

*Size: **150** lines of code.*

---

## 📄 `components/ui/Badge.tsx`

> **Description:** Badge — status pill. Color is driven entirely by semantic status tokens. Status → Color mapping (applied identically everywhere a status appears): in_progress / inProgress → warning (amber) scheduled               → info (blue) completed               → success (green) cancelled               → muted (slate) pass                    → success fail                    → danger open                    → danger quoted / monitoring     → warning repaired                → success urgent                  → danger high                    → warning normal / low            → muted Usage:  <Badge status="in_progress" />  or  <Badge status="completed" />
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function Badge`
```tsx
export function Badge({ status, label }
```

*Size: **114** lines of code.*

---

## 📄 `components/ui/Button.tsx`

> **Description:** Button — three strict variants, consistent dimensions everywhere. Variants: primary     — filled orange, white text. CTAs only: "Start Job", "Save", "Complete" secondary   — ghost/outline style (border + transparent bg). Secondary actions. destructive — red fill. Destructive actions: "Delete", "Remove", "Discard" Height: 48px always (large). Small = 36px for inline/secondary contexts. Radius: T.radiusButton (10px) always. Do NOT pass a custom `color` to make an orange icon or a navy button. If your use case isn't covered by these three variants, question whether you need a button at all — or open a PR to add a justified new variant.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function Button`
```tsx
export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'large',
  loading,
  isLoading,
  disabled,
  icon,
  style,
  textStyle,
}
```

*Size: **146** lines of code.*

---

## 📄 `components/ui/Card.tsx`

> **Description:** Card — the single container used for every info block in SiteTrack. Variants: default  — standard surface card (nav, job details, stat tiles) warning  — amber-tinted for pending / attention states danger   — red-tinted for hazards, failed inspections, destructive banners info     — blue-tinted for access notes, navigation hints success  — green-tinted for completed / passed states Do NOT hand-style background/border on any container. Pick the right variant and let this component handle it.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function Card`
```tsx
export function Card({
  children,
  variant = 'default',
  style,
  padding = T.space16,
  noPadding,
  onPress,
}
```

#### `const cardShadow`
```tsx
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 0,
}
```

*Size: **103** lines of code.*

---

## 📄 `components/ui/EmptyState.tsx`

> **Description:** EmptyState — uniform empty state used across every zero-data screen. Rules: - No emoji. A muted MaterialCommunityIcons icon only. - Title in Typography.cardTitle (sentence case, not all-caps). - Subtitle in Typography.body. - CTA button uses Button variant="primary" if provided. Usage: <EmptyState icon="calendar-blank-outline" title="No jobs scheduled today" subtitle="Your queue is clear. Pull to refresh." />
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function EmptyState`
```tsx
export function EmptyState({ icon, title, subtitle, actionLabel, onAction }
```

*Size: **92** lines of code.*

---

## 📄 `components/ui/FilterPills.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function FilterPills`
```tsx
export function FilterPills({ options, activeIndex, onSelect, style, variant = 'light' }
```

#### `type FilterPillOption`
```tsx
export interface FilterPillOption {
  label: string;
  count?: number;
}
```

#### `type FilterPillsProps`
```tsx
export interface FilterPillsProps {
  options: FilterPillOption[];
  activeIndex: number;
  onSelect: (index: number) => void;
  style?: ViewStyle;
  /** 'light' = white active pill on dark/navy track (default, for headers)
   *  'dark'  = navy active pill on white track (for content areas) */
  variant?: 'light' | 'dark';
}
```

*Size: **130** lines of code.*

---

## 📄 `components/ui/FormField.tsx`

> **Description:** FormField — standardized label-above-input pattern used everywhere a user types. Enforces: - Consistent label typography (Typography.label) - Consistent input background (T.surfaceInput) - Consistent border (T.border, focused → T.primary) - Consistent radius (T.radiusButton = 10px) - Consistent placeholder color (T.textMuted) Usage: <FormField label="Client Name" value={name} onChangeText={setName} /> <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function FormField`
```tsx
export function FormField({
  label,
  error,
  containerStyle,
  multiline,
  ...inputProps
}
```

*Size: **100** lines of code.*

---

## 📄 `components/ui/index.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
export * from './Badge';
export * from './Button';
export * from './Card';
export * from './EmptyState';
export * from './FilterPills';
export * from './FormField';
export * from './Input';
export * from './ScreenHeader';
export * from './SectionHeader';
export * from './SectionTitle';  // kept for backward compat — use SectionHeader going forward
export * from './SkeletonCard';
```

*Size: **12** lines of code.*

---

## 📄 `components/ui/Input.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function Input`
```tsx
export function Input({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize,
  error, disabled, multiline, numberOfLines, maxLength, leftIcon, rightIcon, style
}
```

#### `type InputProps`
```tsx
export interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
}
```

*Size: **121** lines of code.*

---

## 📄 `components/ui/ScreenHeader.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function ScreenHeader`
```tsx
export function ScreenHeader({
  title,
  subtitle,
  rightComponent,
  showBack = false,
  eyebrow,
}
```

*Size: **125** lines of code.*

---

## 📄 `components/ui/SectionHeader.tsx`

> **Description:** SectionHeader — eyebrow-style label used above every section group. This is a DISPLAY component, not a full page header. For page-level headers use ScreenHeader. Usage: <SectionHeader title="Today's Jobs" /> <SectionHeader title="Quick Actions" rightLabel="See all" onRightPress={...} /> Renders as sentence-case with a muted color — NOT all-caps (that's eyebrow style). If you want the eyebrow variant pass eyebrow={true}.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function SectionHeader`
```tsx
export function SectionHeader({
  title,
  eyebrow = false,
  rightLabel,
  onRightPress,
  style,
}
```

*Size: **77** lines of code.*

---

## 📄 `components/ui/SectionTitle.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function SectionTitle`
```tsx
export function SectionTitle({ title, count, rightLabel, onRightPress }
```

*Size: **69** lines of code.*

---

## 📄 `components/ui/SkeletonCard.tsx`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Reusable React component. **We expect this to receive props and render a specific piece of the UI independently.**

### Core Code Logic & Implementations:

#### `function SkeletonBlock`
```tsx
export function SkeletonBlock({ width, height, borderRadius = 8, style }
```

#### `function SkeletonCard`
```tsx
export function SkeletonCard() {
  const C = useColors();
  return (
    <View style={[styles.card, { backgroundColor: C.surface }, cardShadow]}>
      <View style={[styles.strip, { backgroundColor: C.border }]} />
      <View style={styles.body}>
        <SkeletonBlock width="65%" height={14} borderRadius={6} />
        <SkeletonBlock width="45%" height={11} borderRadius={5} style={{ marginTop: 8 }} />
        <View style={styles.rowGap}>
          <SkeletonBlock width={72} height={22} borderRadius={11} />
          <SkeletonBlock width={52} height={22} borderRadius={11} />
        </View>
      </View>
    </View>
  );
}
```

*Size: **97** lines of code.*

---

# 📁 `constants/` Directory

## 📄 `constants/AssetData.ts`

> **Description:** AssetData.ts — Single source of truth for all fire-safety asset types, their sub-variants, inspection routines, display icons and colours. Extracted from 25 real-world Uptick screenshots captured on a live job (T-14231) CA 2026 - 153 Parramatta... Structure mirrors the "Edit Asset" form in the reference app: Type → Variant → Inspection Routine (auto-assigned) → Location → Ref
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `function getInspectionRoutine`
```tsx
export function getInspectionRoutine(assetType: string): string {
  return ASSET_TYPE_MAP[assetType]?.inspectionRoutine ?? 'General Inspection (Annual)';
}
```

#### `function getVariantsForType`
```tsx
export function getVariantsForType(assetType: string): string[] {
  return ASSET_TYPE_MAP[assetType]?.variants ?? [];
}
```

#### `function getAssetTypeIcon`
```tsx
export function getAssetTypeIcon(assetType: string): IconName {
  // Exact match first
  if (ASSET_TYPE_MAP[assetType]) return ASSET_TYPE_MAP[assetType].icon;

  // Legacy / freeform type fallback — fuzzy keyword matching
  const t = (assetType ?? '').toLowerCase();
  if (t.includes('extinguisher'))               return 'fire-extinguisher';
  if (t.includes('sprinkler'))                  return 'water';
  if (t.includes('door'))                       return 'door';
  if (t.includes('exit'))                       return 'exit-run';
  if (t.includes('light') || t.includes('emergency')) return 'lightning-bolt';
  if (t.includes('alarm') || t.includes('smoke'))     return 'smoke-detector';
  if (t.includes('hose'))                       return 'pipe';
  if (t.includes('hydrant'))                    return 'pipe-valve';
  if (t.includes('mcp') || t.includes('call'))  return 'alarm-light';
  if (t.includes('detect'))                     return 'smoke-detector';
  return 'shield-check-outline';
}
```

#### `function getAssetTypeColor`
```tsx
export function getAssetTypeColor(assetType: string): string {
  return ASSET_TYPE_MAP[assetType]?.color ?? '#6B7280';
}
```

#### `type AssetTypeDefinition`
```tsx
export interface AssetTypeDefinition {
  /** Canonical value stored in the database (asset_type column) */
  value: string;
  /** Short display label for grid tiles */
  label: string;
  /** Full label as shown in the "Type" heading of Edit Asset form */
  fullLabel: string;
  /** MaterialCommunityIcons icon name */
  icon: IconName;
  /** Hex accent colour for the tile and icon */
  color: string;
  /** Inspection routine auto-assigned when this type is selected */
  inspectionRoutine: string;
  /** Sub-variants available for this asset type */
  variants: string[];
}
```

*Size: **308** lines of code.*

---

## 📄 `constants/Checklists.ts`

> **Description:** Checklists.ts — Compliance checklist definitions for all 9 official fire safety asset types. Keys MUST exactly match the `value` field in AssetData.ts ASSET_TYPES. Each checklist is used by ChecklistModal during an inspection. When a checklist is completed and all items pass → asset result = Pass. If any item fails → technician is prompted to log a defect.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `type ChecklistItem`
```tsx
export interface ChecklistItem {
  id: string;
  question: string;
  type: 'boolean' | 'text' | 'dropdown';
  options?: string[];   // only for 'dropdown' type
  required: boolean;
  hint?: string;        // optional guidance shown below the question
}
```

#### `type ChecklistTemplate`
```tsx
export interface ChecklistTemplate {
  asset_type: string;
  items: ChecklistItem[];
}
```

*Size: **149** lines of code.*

---

## 📄 `constants/Colors.ts`

> **Description:** SiteTrack — Single Design Token Source of Truth SiteTrack is a dark-only field service app. There is no light mode. useColors() always returns this palette. Rule: Every color in the app must trace back to one of these tokens. No hardcoded hex values outside this file — ever.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `const T`
```tsx
export const T = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  /** App root background — deep navy */
  background:        palette.navy800,
  /** Card / container surface — slightly elevated above background */
  surface:           palette.navy700,
  /** Elevated modals / bottom sheets */
  surfaceElevated:   palette.navy500,
  /** Input fields, chips, pill backgrounds */
  surfaceInput:      palette.navy500,

  // ── Borders ──────────────────────────────────────────────────────────────
  /** Default subtle border for cards, inputs */
  border:            palette.navy400,
  /** Slightly stronger border for focused inputs */
  borderStrong:      palette.navy300,

  // ── Text (3 tiers only — use nothing else) ───────────────────────────────
  /** Primary text — highest contrast, headings and values */
  textPrimary:       palette.white,
  /** Secondary text — body copy, descriptions */
  textSecondary:     palette.slate300,
  /** Muted text — labels, timestamps, eyebrows, placeholders */
  textMuted:         palette.slate400,

  // ── Brand / Primary Action ────────────────────────────────────────────────
  /**
   * Orange — RESERVED for:
   * - Primary CTA buttons only ("Start Job", "Save", "Complete")
   * - The single active-state indicator (tab bar, focused input highlight)
   * Do NOT use for icons, decoration, or stat numbers.
   */
  primary:           palette.orange500,
  primaryPressed:    palette.orange400,

  // ── Status Colors (strictly semantic — one purpose each) ─────────────────
  /** Green — completed / passed / positive states only */
  success:           palette.green600,
  successBg:         palette.greenBg,
  successDark:       palette.green900,

  /** Amber — pending / attention / warning states only */
  warning:           palette.amber600,
  warningBg:         palette.amberBg,
  warningDark:       palette.amber900,

  /**
   * Red — hazards / failed inspections / destructive actions only
   * (formerly "error" — renamed for semantic clarity)
   */
  danger:            palette.red600,
  dangerBg:          palette.redBg,
  dangerDark:        palette.red900,

  /**
   * Blue — navigation links and info-only banners only.
   * Do NOT use for badges, icon backgrounds, or decoration.
   */
  info:              palette.blue600,
  infoBg:            palette.blueBg,

  // ── Spacing Scale (export for shared usage) ───────────────────────────────
  space4:   4,
  space8:   8,
  space12:  12,
  space16:  16,
  space24:  24,
  space32:  32,

  // ── Radius Scale ─────────────────────────────────────────────────────────
  /** Cards, info blocks, list containers */
  radiusCard:    16,
  /** Buttons, text inputs */
  radiusButton:  10,
  /** Chips, status pills — fully rounded */
  radiusPill:    999,

  // ── Icon Tint Rule ────────────────────────────────────────────────────────
  /**
   * Icon circle background = iconColor at 15% opacity.
   * Applied uniformly everywhere an icon sits in a circle bg.
   * Usage: { backgroundColor: T.iconBg(T.textMuted) }
   */
  iconBg: (color: string) => color + '26', // 26 hex = 15% opacity
}
```

*Size: **184** lines of code.*

---

## 📄 `constants/Company.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `const CompanyConfig`
```tsx
export const CompanyConfig = {
  name: 'UMA Building Services Pty Ltd',
  addressLine1: 'P.O. Box 357',
  addressLine2: 'Lidcombe NSW 1825',
  abn: '51602019081',
  contactEmail: 'info@uma-building-services.com.au',
  contactPhone: '1300 748 387',
  website: 'www.uma-building-services.com.au',
}
```

*Size: **10** lines of code.*

---

## 📄 `constants/Config.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `const SYNC_INTERVAL_MS`
```tsx
export const SYNC_INTERVAL_MS = 60_000;
```

#### `const MAX_PHOTOS_PER_DEFECT`
```tsx
export const MAX_PHOTOS_PER_DEFECT = 10;
```

#### `const APP_NAME`
```tsx
export const APP_NAME = 'UMA BUILDING SERVICES';
```

#### `const BUNDLE_ID`
```tsx
export const BUNDLE_ID = 'com.uma-building-services.app';
```

#### `const OFFLINE_CACHE_DAYS`
```tsx
export const OFFLINE_CACHE_DAYS = 30;
```

#### `const DB_NAME`
```tsx
export const DB_NAME = 'uma-building-services.db';
```

#### `const LAST_SYNCED_KEY`
```tsx
export const LAST_SYNCED_KEY = '@uma-building-services/last_synced';
```

#### `const SESSION_KEY`
```tsx
export const SESSION_KEY = '@uma-building-services/session';
```

#### `const PAGE_SIZE`
```tsx
export const PAGE_SIZE = 50;
```

#### `const REQUEST_TIMEOUT_MS`
```tsx
export const REQUEST_TIMEOUT_MS = 30_000;
```

*Size: **33** lines of code.*

---

## 📄 `constants/DefectCodes.ts`

> **Description:** DefectCodes.ts — Uptick Australia Defect Code Library Complete codebook extracted from the Uptick Australia reference spreadsheet. Codes cover fire doors, smoke seals, hardware, alarms, smoke detectors, windows, and general issues. quote_price: Reference rate in AUD (ex-GST). These are Uptick industry reference rates. — Can be overridden per-job on the quote screen. — Can be updated here or via Supabase config as pricing changes. category: Used to group codes in the picker UI.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `function findDefectCode`
```tsx
export function findDefectCode(code: string): DefectCode | undefined {
  return DEFECT_CODES.find(d => d.code.toLowerCase() === code.toLowerCase());
}
```

#### `function getDefectsByCategory`
```tsx
export function getDefectsByCategory(category: DefectCategory): DefectCode[] {
  return DEFECT_CODES.filter(d => d.category === category);
}
```

#### `function searchDefectCodes`
```tsx
export function searchDefectCodes(query: string): DefectCode[] {
  const q = query.toLowerCase().trim();
  if (!q) return DEFECT_CODES;
  return DEFECT_CODES.filter(
    d =>
      d.code.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
  );
}
```

#### `type DefectCode`
```tsx
export interface DefectCode {
  /** Short code used as identifier (e.g. "bg", "hg", "lsc") */
  code: string;
  /** Full description of the defect as shown in report */
  description: string;
  /** Reference quote price in AUD ex-GST (undefined = investigation required / no fixed price) */
  quote_price?: number;
  /** Display category for grouping in the picker */
  category: DefectCategory;
}
```

#### `type DefectCategory`
```tsx
export type DefectCategory =
  | 'Gap'
  | 'Seal'
  | 'Hardware'
  | 'Delamination'
  | 'Alarm'
  | 'Lock'
  | 'Hinge'
  | 'Access'
  | 'Window'
  | 'Compliance'
  | 'General';

// ─── Full Defect Code Library ─────────────────────────────────────────────────

export const DEFECT_CODES: DefectCode[] = [

  // ── A ──────────────────────────────────────────────────────────────────────
  {
    code: 'anf',
    description: 'Alarm not indicated on FIP — require investigation $85/hr',
    category: 'Alarm',
  }
```

*Size: **830** lines of code.*

---

## 📄 `constants/Enums.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

- *No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.*

*Size: **84** lines of code.*

---

## 📄 `constants/headerPad.ts`

> **Description:** Shared safe-area top padding for screen headers. Uses the actual status bar height on Android so headers never eat into the status bar area. On iOS the root layout already accounts for the notch.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `const HEADER_TOP_PAD`
```tsx
export const HEADER_TOP_PAD =
```

*Size: **11** lines of code.*

---

## 📄 `constants/Typography.ts`

> **Description:** Typography Scale — single source of truth. Rules: - eyebrow is the ONLY place all-caps text appears in the app. - Section titles are sentence-case, not screaming caps. - Nothing outside this file should hardcode fontSize/fontWeight. NOTE: Color is intentionally NOT embedded in these styles. Apply color separately via { color: T.textPrimary } etc. This keeps typography portable and avoids circular import issues.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `const Typography`
```tsx
export const Typography = {
  /** Screen-level heading — "Pandav Farm", "Inspection Form" */
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  } as TextStyle,

  /** Bold text inside a card — property name, defect description */
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  } as TextStyle,

  /** Section group labels — "Today's Jobs", "Quick Actions" — sentence case */
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  } as TextStyle,

  /** Standard readable body copy */
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
  } as TextStyle,

  /** Small label placed above an input field */
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  } as TextStyle,

  /**
   * Eyebrow — micro-label.
   * THE ONLY PLACE all-caps appears in the app.
   * Usage: "JOB #5F422FDB", "Site Hazard" demoted here in small print.
   */
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  } as TextStyle,

  /** Muted supporting text under a title */
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
  } as TextStyle,

  /** Numbers inside KPI/stat tiles */
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  } as TextStyle,
}
```

*Size: **76** lines of code.*

---

# 📁 `hooks/` Directory

## 📄 `hooks/use-color-scheme.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### Raw File Source
```sql
export { useColorScheme } from 'react-native';
```

*Size: **2** lines of code.*

---

## 📄 `hooks/use-color-scheme.web.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `function useColorScheme`
```tsx
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
```

*Size: **22** lines of code.*

---

## 📄 `hooks/use-theme-color.ts`

> **Description:** Learn more about light and dark modes: https://docs.expo.dev/guides/color-schemes/
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `function useThemeColor`
```tsx
export function useThemeColor(
  props: { light?: string; dark?: string }
```

*Size: **22** lines of code.*

---

## 📄 `hooks/useAuth.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `function useAuth`
```tsx
export function useAuth() {
  const {
    user,
    session,
    isLoading,
    isAuthenticated,
    error,
    signIn,
    signOut,
    restoreSession,
    updateUser,
    clearError,
  } = useAuthStore();

  /** Human-readable error — maps Supabase codes to friendly messages */
  const friendlyError = error
    ? error
        .replace('Invalid login credentials', 'Incorrect email or password.')
        .replace('Email not confirmed', 'Please verify your email before signing in.')
        .replace('User not found', 'No account found with that email address.')
        .replace(/Network request failed|fetch failed/i, 'Network Error: Please check your internet connection and ensure the server is reachable.')
    : null;

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    error: friendlyError,
    rawError: error,
    signIn,
    signOut,
    restoreSession,
    updateUser,
    clearError,
    /** First name only, for greeting display */
    firstName: user?.full_name?.split(' ')[0] ?? 'Technician',
  };
}
```

*Size: **43** lines of code.*

---

## 📄 `hooks/useColors.ts`

> **Description:** useColors — always returns the dark navy palette. SiteTrack is a field-service app designed for technicians working on-site. The dark navy theme (#0F1E3C / #182745 / #2D4068 / #E8650A) is the primary design language matching the Project Work prototype and the app.json setting of userInterfaceStyle: "dark". We do NOT switch to the light theme based on system preferences — the app is always dark to maintain consistent field-app aesthetics. Usage:  const C = useColors();  →  C.primary, C.surface, C.accent …
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `function useColors`
```tsx
export function useColors(): typeof Colors.dark {
  return Colors.dark;
}
```

*Size: **19** lines of code.*

---

## 📄 `hooks/useNetworkStatus.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `function useNetworkStatus`
```tsx
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: false,          // fail-safe: assume offline until NetInfo confirms
    connectionType: null,
    isInternetReachable: null,
  });

  // Track previous online state to detect false → true transition
  const prevOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Get initial state (don't show toast on first mount)
    NetInfo.fetch().then((state: NetInfoState) => {
      const online = state.isConnected === true;
      prevOnlineRef.current = online;
      setStatus({
        isOnline: online,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
      });
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true;
      const wasOffline = prevOnlineRef.current === false;

      setStatus({
        isOnline: online,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
      });

      // Reconnection detected → trigger sync + show toast
      if (wasOffline && online) {
        Toast.show({
          type: 'info',
          text1: '🌐 Back online',
          text2: 'Syncing your offline changes...',
          visibilityTime: 3000,
        });
        // Pass cached userId — avoids a Supabase auth round-trip on reconnect
        void runSync(getCachedUserId() ?? undefined);
      }

      prevOnlineRef.current = online;
    });

    return () => unsubscribe();
  }, []);

  return status;
}
```

*Size: **67** lines of code.*

---

# 📁 `lib/` Directory

## 📄 `lib/database.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core business logic module. **We expect this to handle data processing, database interactions, or external integrations.**

### Core Code Logic & Implementations:

#### `function openDatabase`
```tsx
export function openDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(DB_NAME);
  }
  return _db;
}
```

#### `function initializeSchema`
```tsx
export function initializeSchema(): void {
  const db = openDatabase();

  // ── Core tables (always idempotent) ──────────────────────────
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY NOT NULL,
      company_id TEXT,
      email      TEXT UNIQUE NOT NULL,
      full_name  TEXT NOT NULL,
      role                 TEXT NOT NULL DEFAULT 'technician',
      phone                TEXT,
      avatar_url           TEXT,
      push_token           TEXT,
      is_active            INTEGER NOT NULL DEFAULT 1,
      fpas_number          TEXT,
      fpas_class           TEXT,
      fpas_expiry          TEXT,
      state_license        TEXT,
      state_license_expiry TEXT,
      accepted_tos_at      TEXT,
      accepted_aup_at      TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companies (
      id                  TEXT PRIMARY KEY NOT NULL,
      name                TEXT NOT NULL,
      abn                 TEXT,
      contact_email       TEXT,
      phone               TEXT,
      website              TEXT,
      address              TEXT,
      logo_url             TEXT,
      subscription_status  TEXT NOT NULL DEFAULT 'active',
      notification_settings TEXT,
      compliance_standards TEXT,
      appearance_settings  TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS properties (
      id                 TEXT PRIMARY KEY NOT NULL,
      company_id         TEXT,
      name               TEXT NOT NULL,
      address            TEXT,
      suburb             TEXT,
      state              TEXT,
      postcode           TEXT,
      site_contact_name  TEXT,
      site_contact_phone TEXT,
      access_notes       TEXT,
      hazard_notes       TEXT,
      site_note          TEXT,
      compliance_status  TEXT NOT NULL DEFAULT 'pending',
      next_inspection_date TEXT,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id                TEXT PRIMARY KEY NOT NULL,
      company_id        TEXT,
      property_id       TEXT NOT NULL,
      asset_type        TEXT NOT NULL,
      variant           TEXT,
      asset_ref         TEXT,
      description       TEXT,
      location_on_site  TEXT,
      serial_number     TEXT,
      barcode_id        TEXT,
      install_date      TEXT,
      last_service_date TEXT,
      next_service_date TEXT,
      status            TEXT NOT NULL DEFAULT 'active',
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id             TEXT PRIMARY KEY NOT NULL,
      company_id     TEXT,
      property_id    TEXT NOT NULL,
      assigned_to    TEXT NOT NULL,
      job_type       TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'scheduled',
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT,
      priority       TEXT NOT NULL DEFAULT 'normal',
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      report_url     TEXT,
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS job_assets (
      id               TEXT PRIMARY KEY NOT NULL,
      company_id       TEXT,
      job_id           TEXT NOT NULL,
      asset_id         TEXT NOT NULL,
      result           TEXT,
      checklist_data   TEXT,
      is_compliant     INTEGER NOT NULL DEFAULT 0,
      defect_reason    TEXT,
      technician_notes TEXT,
      actioned_at      TEXT,
      FOREIGN KEY (job_id)   REFERENCES jobs(id),
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );

    CREATE TABLE IF NOT EXISTS defects (
      id          TEXT PRIMARY KEY NOT NULL,
      company_id  TEXT,
      job_id      TEXT NOT NULL,
      asset_id    TEXT NOT NULL,
      property_id TEXT NOT NULL,
      description TEXT NOT NULL,
      severity    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open',
      photos      TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      defect_code TEXT,
      quote_price REAL,
      FOREIGN KEY (job_id)      REFERENCES jobs(id),
      FOREIGN KEY (asset_id)    REFERENCES assets(id),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_photos (
      id          TEXT PRIMARY KEY NOT NULL,
      company_id  TEXT,
      job_id      TEXT NOT NULL,
      asset_id    TEXT,
      photo_url   TEXT NOT NULL,
      caption     TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      uploaded_by TEXT NOT NULL,
      defect_id   TEXT,
      FOREIGN KEY (job_id)      REFERENCES jobs(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id),
      FOREIGN KEY (defect_id)   REFERENCES defects(id)
    );

    CREATE TABLE IF NOT EXISTS signatures (
      id                  TEXT PRIMARY KEY NOT NULL,
      company_id          TEXT,
      job_id              TEXT NOT NULL UNIQUE,
      signature_url       TEXT NOT NULL,
      tech_signature_url  TEXT,
      signed_by_name      TEXT NOT NULL,
      signed_at           TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS time_logs (
      id                  TEXT PRIMARY KEY NOT NULL,
      company_id          TEXT,
      job_id              TEXT NOT NULL,
      user_id             TEXT NOT NULL,
      clock_in            TEXT NOT NULL,
      clock_out           TEXT,
      gps_lat             REAL,
      gps_lng             REAL,
      travel_time_minutes INTEGER,
      FOREIGN KEY (job_id)  REFERENCES jobs(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name  TEXT NOT NULL,
      record_id   TEXT NOT NULL,
      operation   TEXT NOT NULL,
      payload     TEXT NOT NULL,
      synced      INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tombstone table: permanently records photo IDs that the technician has deleted.
    -- Used by the sync pull to prevent Supabase from re-inserting deleted photos
    -- even when the remote delete is still pending, failed, or retrying.
    CREATE TABLE IF NOT EXISTS deleted_photo_ids (
      id         TEXT PRIMARY KEY NOT NULL,
      deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id          TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      price       REAL NOT NULL DEFAULT 0.0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id           TEXT PRIMARY KEY NOT NULL,
      job_id       TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'draft',
      total_amount REAL NOT NULL DEFAULT 0.0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS quote_items (
      id                TEXT PRIMARY KEY NOT NULL,
      quote_id          TEXT NOT NULL,
      inventory_item_id TEXT,           -- nullable: supports custom line items with item_name
      defect_id         TEXT,
      quantity          INTEGER NOT NULL DEFAULT 1,
      unit_price        REAL NOT NULL DEFAULT 0.0,
      item_name         TEXT,
      FOREIGN KEY (quote_id)          REFERENCES quotes(id),
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY NOT NULL,
      type       TEXT NOT NULL DEFAULT 'general',
      title      TEXT NOT NULL,
      message    TEXT NOT NULL,
      job_id     TEXT,
      user_id    TEXT,           -- which technician this notification is for
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created  ON notifications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to       ON jobs(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_jobs_status            ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date    ON jobs(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_assets_property_id     ON assets(property_id);
    CREATE INDEX IF NOT EXISTS idx_defects_job_id         ON defects(job_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_synced       ON sync_queue(synced);
    CREATE INDEX IF NOT EXISTS idx_job_assets_asset_id    ON job_assets(asset_id);

    CREATE TABLE IF NOT EXISTS asset_type_definitions (
      id                 TEXT    PRIMARY KEY NOT NULL,
      value              TEXT    NOT NULL,
      label              TEXT    NOT NULL,
      full_label         TEXT    NOT NULL,
      icon               TEXT    NOT NULL DEFAULT 'shield-check-outline',
      color              TEXT    NOT NULL DEFAULT '#6B7280',
      inspection_routine TEXT    NOT NULL DEFAULT '',
      variants           TEXT    NOT NULL DEFAULT '[]',
      is_active          INTEGER NOT NULL DEFAULT 1,
      sort_order         INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS defect_codes (
      id          TEXT    PRIMARY KEY NOT NULL,
      code        TEXT    NOT NULL,
      description TEXT    NOT NULL,
      quote_price REAL,
      category    TEXT    NOT NULL DEFAULT 'General',
      is_active   INTEGER NOT NULL DEFAULT 1,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Versioned migrations ───────────────────────────────────
  // Read current stored version (0 if meta table was just created)
  const versionRow = db.getFirstSync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'schema_version'`,
  );
  let currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

  if (__DEV__)
    console.log(
      `[UMA BUILDING SERVICES DB] Schema at version ${currentVersion}, target ${CURRENT_SCHEMA_VERSION}`,
    );

  // Migration 1: push_token column on users (was originally a try/catch hack)
  if (currentVersion < 1) {
    try {
      db.runSync("ALTER TABLE users ADD COLUMN push_token TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 1: added users.push_token");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only ignore "already exists" errors — surface everything else
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 1 failed:", msg);
      }
    }
    currentVersion = 1;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1')`,
    );
  }

  // Migration 2: checklist_data + is_compliant on job_assets
  if (currentVersion < 2) {
    try {
      db.runSync("ALTER TABLE job_assets ADD COLUMN checklist_data TEXT;");
      if (__DEV__)
        console.log(
          "[UMA BUILDING SERVICES DB] Migration 2a: added job_assets.checklist_data",
        );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 2a failed:", msg);
      }
    }
    try {
      db.runSync(
        "ALTER TABLE job_assets ADD COLUMN is_compliant INTEGER NOT NULL DEFAULT 0;",
      );
      if (__DEV__)
        console.log(
          "[UMA BUILDING SERVICES DB] Migration 2b: added job_assets.is_compliant",
        );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 2b failed:", msg);
      }
    }
    currentVersion = 2;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '2')`,
    );
  }

  // Migration 3: idx_job_assets_asset_id index for faster previous-result lookups
  if (currentVersion < 3) {
    try {
      db.runSync(
        "CREATE INDEX IF NOT EXISTS idx_job_assets_asset_id ON job_assets(asset_id);",
      );
      if (__DEV__)
        console.log(
          "[UMA BUILDING SERVICES DB] Migration 3: added idx_job_assets_asset_id",
        );
    } catch (err: unknown) {
      console.error(
        "[UMA BUILDING SERVICES DB] Migration 3 failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
    currentVersion = 3;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '3')`,
    );
  }

  // Migration 4: retry_count + last_error on sync_queue for safe retry limiting
  if (currentVersion < 4) {
    try {
      db.runSync(
        "ALTER TABLE sync_queue ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;",
      );
      if (__DEV__)
        console.log(
          "[UMA BUILDING SERVICES DB] Migration 4a: added sync_queue.retry_count",
        );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 4a failed:", msg);
      }
    }
    try {
      db.runSync("ALTER TABLE sync_queue ADD COLUMN last_error TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 4b: added sync_queue.last_error");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 4b failed:", msg);
      }
    }
    currentVersion = 4;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '4')`,
    );
  }

  // Migration 5: variant + asset_ref columns on assets table
  if (currentVersion < 5) {
    try {
      db.runSync("ALTER TABLE assets ADD COLUMN variant TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 5a: added assets.variant");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 5a failed:", msg);
      }
    }
    try {
      db.runSync("ALTER TABLE assets ADD COLUMN asset_ref TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 5b: added assets.asset_ref");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 5b failed:", msg);
      }
    }
    currentVersion = 5;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '5')`,
    );
  }

  // Migration 6: defect_code + quote_price on defects table (Uptick code library integration)
  if (currentVersion < 6) {
    try {
      db.runSync("ALTER TABLE defects ADD COLUMN defect_code TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 6a: added defects.defect_code");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 6a failed:", msg);
      }
    }
    try {
      db.runSync("ALTER TABLE defects ADD COLUMN quote_price REAL;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 6b: added defects.quote_price");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 6b failed:", msg);
      }
    }
    // Also add item_name to quote_items to support custom (non-inventory) line items
    try {
      db.runSync("ALTER TABLE quote_items ADD COLUMN item_name TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 6c: added quote_items.item_name");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 6c failed:", msg);
      }
    }
    currentVersion = 6;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '6')`,
    );
  }

  // Migration 7: Normalise defect photos into inspection_photos
  if (currentVersion < 7) {
    try {
      db.runSync("ALTER TABLE inspection_photos ADD COLUMN defect_id TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 7: added inspection_photos.defect_id");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 7 failed:", msg);
      }
    }
    currentVersion = 7;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '7')`,
    );
  }

  // Migration 8: asset_type_definitions + defect_codes local cache tables
  if (currentVersion < 8) {
    // Tables created idempotently above in the core block — just bump the version.
    currentVersion = 8;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '8')`,
    );
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 8: catalogue cache tables ready');
  }

  // Migration 9: report_url column on jobs table
  if (currentVersion < 9) {
    try {
      db.runSync("ALTER TABLE jobs ADD COLUMN report_url TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 9: added jobs.report_url");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 9 failed:", msg);
      }
    }
    currentVersion = 9;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '9')`,
    );
  }

  // Migration 10: deleted_photo_ids tombstone table + retry reset for previously-blocked deletes
  if (currentVersion < 10) {
    // 10a — Create the permanent tombstone table
    try {
      db.runSync(`
        CREATE TABLE IF NOT EXISTS deleted_photo_ids (
          id         TEXT PRIMARY KEY NOT NULL,
          deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      if (__DEV__)
        console.log('[UMA BUILDING SERVICES DB] Migration 10a: created deleted_photo_ids tombstone table');
    } catch (err: unknown) {
      console.error('[UMA BUILDING SERVICES DB] Migration 10a failed:', err instanceof Error ? err.message : String(err));
    }

    // 10b — Reset permanently-failed photo delete operations so they are retried.
    // These items previously exhausted their retry limit because Supabase was blocking
    // them with a missing RLS DELETE policy.  Now that the policy exists, resetting
    // synced=0 and retry_count=0 lets the next sync push the deletes successfully.
    try {
      const result = db.runSync(
        `UPDATE sync_queue
         SET synced = 0, retry_count = 0, last_error = NULL
         WHERE table_name = 'inspection_photos'
           AND operation  = 'delete'
           AND synced     = -1`,
      );
      if (__DEV__ && result.changes > 0)
        console.log(`[UMA BUILDING SERVICES DB] Migration 10b: reset ${result.changes} permanently-failed photo delete(s) for retry`);
    } catch (err: unknown) {
      console.error('[UMA BUILDING SERVICES DB] Migration 10b failed:', err instanceof Error ? err.message : String(err));
    }

    currentVersion = 10;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '10')`);
  }

  // Migration 11: next_inspection_date on properties table
  if (currentVersion < 11) {
    try {
      db.runSync("ALTER TABLE properties ADD COLUMN next_inspection_date TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 11: added properties.next_inspection_date");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 11 failed:", msg);
      }
    }
    currentVersion = 11;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '11')`,
    );
  }

  // Migration 12: site_note on properties table
  if (currentVersion < 12) {
    try {
      db.runSync("ALTER TABLE properties ADD COLUMN site_note TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 12: added properties.site_note");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 12 failed:", msg);
      }
    }
    currentVersion = 12;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '12')`,
    );
  }

  // Migration 13: make inspection_photos.uploaded_by nullable.
  // SQLite cannot ALTER COLUMN, so we use the table-rename pattern inside a transaction.
  // This is needed because PhotoCaptureSheet now correctly sends null instead of 'unknown'
  // when no user session is available (edge case — the UI also guards against this).
  if (currentVersion < 13) {
    try {
      db.execSync(`
        PRAGMA foreign_keys = OFF;
        BEGIN TRANSACTION;

        CREATE TABLE IF NOT EXISTS inspection_photos_v13 (
          id          TEXT PRIMARY KEY NOT NULL,
          job_id      TEXT NOT NULL,
          asset_id    TEXT,
          photo_url   TEXT NOT NULL,
          caption     TEXT,
          uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
          uploaded_by TEXT,
          defect_id   TEXT,
          FOREIGN KEY (job_id)    REFERENCES jobs(id),
          FOREIGN KEY (defect_id) REFERENCES defects(id)
        );

        INSERT INTO inspection_photos_v13
          SELECT id, job_id, asset_id, photo_url, caption, uploaded_at, uploaded_by, defect_id
          FROM inspection_photos;

        DROP TABLE inspection_photos;

        ALTER TABLE inspection_photos_v13 RENAME TO inspection_photos;

        COMMIT;
        PRAGMA foreign_keys = ON;
      `);
      if (__DEV__)
        console.log('[UMA BUILDING SERVICES DB] Migration 13: inspection_photos.uploaded_by is now nullable');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[UMA BUILDING SERVICES DB] Migration 13 failed:', msg);
    }
    currentVersion = 13;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '13')`);
  }

  // Migration 14: batch of schema alignment fixes
  //   14a — quote_items.inventory_item_id: make nullable (supports custom line items)
  //   14b — notifications: add user_id column (aligns with Supabase schema)
  //   14c — asset_type_definitions: add updated_at column
  if (currentVersion < 14) {
    // 14a: SQLite cannot change NOT NULL without table rebuild — inventory_item_id was
    // already nullable in practice (INSERT OR REPLACE always worked), so this is a
    // documentation-only fix in the CREATE TABLE above. No ALTER needed.

    // 14b: notifications.user_id
    try {
      db.runSync('ALTER TABLE notifications ADD COLUMN user_id TEXT;');
      if (__DEV__)
        console.log('[UMA BUILDING SERVICES DB] Migration 14b: added notifications.user_id');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column'))
        console.error('[UMA BUILDING SERVICES DB] Migration 14b failed:', msg);
    }

    // 14c: asset_type_definitions.updated_at
    try {
      db.runSync("ALTER TABLE asset_type_definitions ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));");
      if (__DEV__)
        console.log('[UMA BUILDING SERVICES DB] Migration 14c: added asset_type_definitions.updated_at');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column'))
        console.error('[UMA BUILDING SERVICES DB] Migration 14c failed:', msg);
    }

    currentVersion = 14;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '14')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 14: schema alignment complete');
  }

  // Migration 15: SaaS Pivot - add company_id to all tenant-scoped tables
  // We do a soft wipe of local data here because the remote DB was wiped
  // and we don't want orphaned records trying to push without a company_id.
  if (currentVersion < 15) {
    try {
      const tables = [
        'users', 'properties', 'assets', 'jobs', 'job_assets', 
        'defects', 'inspection_photos', 'signatures', 'time_logs'
      ];
      
      for (const table of tables) {
        db.runSync(`DELETE FROM ${table};`); // Wipe old single-tenant data
        db.runSync(`ALTER TABLE ${table} ADD COLUMN company_id TEXT;`);
      }
      
      // Also clear sync queue to prevent errors
      db.runSync(`DELETE FROM sync_queue;`);
      
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 15: added company_id & cleared old data');
    } catch (err: unknown) {
      console.warn('[UMA BUILDING SERVICES DB] Migration 15 failed (expected if already applied):', err instanceof Error ? err.message : String(err));
    }
    currentVersion = 15;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '15')`);
  }

  // Migration 16: Robust SaaS wipe. Migration 15 might have failed midway if columns existed.
  if (currentVersion < 16) {
    const tables = [
      'users', 'properties', 'assets', 'jobs', 'job_assets', 
      'defects', 'inspection_photos', 'signatures', 'time_logs'
    ];
    
    // First, robustly wipe all tables
    for (const table of tables) {
      try {
        db.runSync(`DELETE FROM ${table};`);
      } catch {}
    }
    try { db.runSync(`DELETE FROM sync_queue;`); } catch {}
    
    // Second, robustly ensure company_id exists
    for (const table of tables) {
      try {
        db.runSync(`ALTER TABLE ${table} ADD COLUMN company_id TEXT;`);
      } catch {} // Will fail if column already exists, which is fine
    }
    
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 16: Robust wipe and company_id check complete');
    
    currentVersion = 16;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '16')`);
  }

  // Migration 17: Add company_id to quotes and quote_items tables.
  // These were missed in migration 15/16 which only targeted tenant-scoped operational tables.
  // Without this, upsertRecord crashes when the sync pulls quotes/quote_items from Supabase
  // because the Supabase rows include a company_id column that doesn't exist in local SQLite.
  if (currentVersion < 17) {
    const quoteTables = ['quotes', 'quote_items'];
    for (const table of quoteTables) {
      try {
        db.runSync(`ALTER TABLE ${table} ADD COLUMN company_id TEXT;`);
        if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Migration 17: added ${table}.company_id`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('duplicate column')) {
          console.error(`[UMA BUILDING SERVICES DB] Migration 17 (${table}) failed:`, msg);
        }
      }
    }
    currentVersion = 17;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '17')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 17: quotes/quote_items company_id complete');
  }

  // Migration 18: Add all FPAS/licence columns to users table.
  // The Supabase users table has 5 compliance columns that were never added to
  // the local SQLite schema. Without all of them, upsertRecord(users) crashes on
  // the first unknown column, which cascades into a FOREIGN KEY failure on jobs.
  // Columns: fpas_number, fpas_class, fpas_expiry, state_license, state_license_expiry
  if (currentVersion < 18) {
    const userCols = [
      'fpas_number TEXT',
      'fpas_class TEXT',
      'fpas_expiry TEXT',
      'state_license TEXT',
      'state_license_expiry TEXT',
    ];
    for (const colDef of userCols) {
      try {
        db.runSync(`ALTER TABLE users ADD COLUMN ${colDef};`);
        if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Migration 18: added users.${colDef.split(' ')[0]}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('duplicate column')) {
          console.error(`[UMA BUILDING SERVICES DB] Migration 18 (${colDef}) failed:`, msg);
        }
      }
    }
    currentVersion = 18;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '18')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 18: all FPAS/licence columns added to users');
  }

  // Migration 19: Add device_info to signatures table.
  // The signature capture screen stores the device OS info alongside each signature
  // for the electronic transaction audit trail. Without this column, the field is
  // skipped by the upsertRecord fallback but never actually persisted.
  if (currentVersion < 19) {
    try {
      db.runSync("ALTER TABLE signatures ADD COLUMN device_info TEXT;");
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 19: added signatures.device_info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column')) console.error('[UMA BUILDING SERVICES DB] Migration 19 failed:', msg);
    }
    currentVersion = 19;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '19')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 19 complete');
  }

  // Migration 20: Wipe catalogue cache to receive new multi-tenant cloned rows
  // The multi-tenant catalogue upgrade script generated new IDs for all catalogue items
  // (cloned per company). To prevent UNIQUE constraint conflicts with the old global rows
  // currently in the local cache, we wipe the local tables. The next sync will simply
  // pull down the correct cloned rows for the current company.
  if (currentVersion < 20) {
    try {
      db.runSync(`DELETE FROM asset_type_definitions;`);
      db.runSync(`DELETE FROM defect_codes;`);
      db.runSync(`DELETE FROM inventory_items;`);
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 20: catalogue caches wiped for multi-tenant upgrade');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[UMA BUILDING SERVICES DB] Migration 20 failed:', msg);
    }
    currentVersion = 20;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '20')`);
  }

  // Migration 21: Remove UNIQUE constraints from catalogue tables
  // In a multi-tenant environment, the remote DB might have duplicates due to 
  // admin cloning, or we might receive rows that conflict. We trust the remote
  // ID and don't want local UNIQUE constraints crashing the sync process.
  if (currentVersion < 21) {
    try {
      db.execSync(`
        PRAGMA foreign_keys = OFF;
        BEGIN TRANSACTION;

        CREATE TABLE IF NOT EXISTS asset_type_definitions_v21 (
          id                 TEXT    PRIMARY KEY NOT NULL,
          value              TEXT    NOT NULL,
          label              TEXT    NOT NULL,
          full_label         TEXT    NOT NULL,
          icon               TEXT    NOT NULL DEFAULT 'shield-check-outline',
          color              TEXT    NOT NULL DEFAULT '#6B7280',
          inspection_routine TEXT    NOT NULL DEFAULT '',
          variants           TEXT    NOT NULL DEFAULT '[]',
          is_active          INTEGER NOT NULL DEFAULT 1,
          sort_order         INTEGER NOT NULL DEFAULT 0,
          created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO asset_type_definitions_v21 SELECT * FROM asset_type_definitions;
        DROP TABLE asset_type_definitions;
        ALTER TABLE asset_type_definitions_v21 RENAME TO asset_type_definitions;

        CREATE TABLE IF NOT EXISTS defect_codes_v21 (
          id          TEXT    PRIMARY KEY NOT NULL,
          code        TEXT    NOT NULL,
          description TEXT    NOT NULL,
          quote_price REAL,
          category    TEXT    NOT NULL DEFAULT 'General',
          is_active   INTEGER NOT NULL DEFAULT 1,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO defect_codes_v21 SELECT * FROM defect_codes;
        DROP TABLE defect_codes;
        ALTER TABLE defect_codes_v21 RENAME TO defect_codes;

        COMMIT;
        PRAGMA foreign_keys = ON;
      `);
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 21: dropped UNIQUE constraints on catalogue tables');
    } catch (err: unknown) {
      console.error('[UMA BUILDING SERVICES DB] Migration 21 failed:', err instanceof Error ? err.message : String(err));
    }
    currentVersion = 21;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '21')`);
  }

  // Migration 22: Force wipe and recreate tables to ensure UNIQUE constraints are gone.
  // If Migration 21 failed silently but bumped the version, users will still get the UNIQUE constraint crash.
  // We can safely wipe these two tables because they are entirely derived from the remote DB and will resync immediately.
  if (currentVersion < 22) {
    try {
      db.execSync(`
        DROP TABLE IF EXISTS asset_type_definitions;
        DROP TABLE IF EXISTS defect_codes;
        
        CREATE TABLE IF NOT EXISTS asset_type_definitions (
          id                 TEXT    PRIMARY KEY NOT NULL,
          value              TEXT    NOT NULL,
          label              TEXT    NOT NULL,
          full_label         TEXT    NOT NULL,
          icon               TEXT    NOT NULL DEFAULT 'shield-check-outline',
          color              TEXT    NOT NULL DEFAULT '#6B7280',
          inspection_routine TEXT    NOT NULL DEFAULT '',
          variants           TEXT    NOT NULL DEFAULT '[]',
          is_active          INTEGER NOT NULL DEFAULT 1,
          sort_order         INTEGER NOT NULL DEFAULT 0,
          created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS defect_codes (
          id          TEXT    PRIMARY KEY NOT NULL,
          code        TEXT    NOT NULL,
          description TEXT    NOT NULL,
          quote_price REAL,
          category    TEXT    NOT NULL DEFAULT 'General',
          is_active   INTEGER NOT NULL DEFAULT 1,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `);
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 22: force-recreated catalogue tables to strip UNIQUE constraints');
    } catch (err: unknown) {
      console.error('[UMA BUILDING SERVICES DB] Migration 22 failed:', err instanceof Error ? err.message : String(err));
    }
    currentVersion = 22;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '22')`);
  }

  // Migration 23: tech_signature_url on signatures table (AS1851 technician sign-off)
  // The CREATE TABLE above already includes this column for fresh installs.
  // This migration adds it safely to existing devices that already have the table.
  if (currentVersion < 23) {
    try {
      db.runSync('ALTER TABLE signatures ADD COLUMN tech_signature_url TEXT;');
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 23: added signatures.tech_signature_url');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column'))
        console.error('[UMA BUILDING SERVICES DB] Migration 23 failed:', msg);
    }
    currentVersion = 23;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '23')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 23 complete');
  }

  // Migration 24: Add remaining missing Supabase columns to users and companies.
  // FIX: previously re-added fpas_number/fpas_class/fpas_expiry/state_license/
  // state_license_expiry here too — those were already added in Migration 18, so this
  // was pure dead weight (harmless since wrapped in try/catch, but redundant).
  // Trimmed to only the genuinely-new columns: accepted_tos_at, accepted_aup_at
  // (Legal Gate timestamps) and the companies columns.
  if (currentVersion < 24) {
    const userCols = ['accepted_tos_at TEXT', 'accepted_aup_at TEXT'];
    for (const col of userCols) {
      try { db.runSync(`ALTER TABLE users ADD COLUMN ${col};`); } catch {}
    }

    const companyCols = [
      'updated_at TEXT', 'notification_settings TEXT',
      'compliance_standards TEXT', 'appearance_settings TEXT'
    ];
    for (const col of companyCols) {
      try { db.runSync(`ALTER TABLE companies ADD COLUMN ${col};`); } catch {}
    }

    currentVersion = 24;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '24')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 24 complete (users/companies columns)');
  }
  // Migration 25: Ensure AS1851-required date columns exist on assets table.
  // These are shown per asset in the PDF (install date, next service date).
  // Fresh installs from the base CREATE TABLE already have them, but upgrades need this.
  if (currentVersion < 25) {
    const assetCols = [
      'install_date TEXT',
      'next_service_date TEXT',
      'last_service_date TEXT',
    ];
    for (const col of assetCols) {
      try { db.runSync(`ALTER TABLE assets ADD COLUMN ${col};`); } catch {}
    }
    currentVersion = 25;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '25')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 25 complete (assets date columns)');
  }

  // Migration 26: Ensure company_id column exists on assets table.
  // Required for Supabase RLS when cloned assets are pushed via the sync queue.
  if (currentVersion < 26) {
    try { db.runSync(`ALTER TABLE assets ADD COLUMN company_id TEXT;`); } catch {}
    currentVersion = 26;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '26')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 26 complete (assets.company_id)');
  }

  // Migration 27: Add company_id to inspection_photos, job_assets, and defects.
  // These three tables are written by the tech in the field and pushed via sync queue.
  // Without company_id the Supabase RLS policy (company_id = auth.jwt() company)
  // silently rejects every INSERT — photos, job results and defects never reach the server.
  if (currentVersion < 27) {
    const cols: [string, string][] = [
      ['inspection_photos', 'company_id TEXT'],
      ['job_assets',        'company_id TEXT'],
      ['defects',           'company_id TEXT'],
    ];
    for (const [tbl, col] of cols) {
      try { db.runSync(`ALTER TABLE ${tbl} ADD COLUMN ${col};`); } catch {}
    }
    currentVersion = 27;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '27')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 27 complete (company_id on photos/job_assets/defects)');
  }

  // Migration 28: Add company_id to signatures table.
  // Signatures are captured by the tech and synced to Supabase via the sync queue.
  // Supabase RLS requires company_id on all tenant-scoped tables — without it
  // every signature INSERT is silently rejected, meaning sign-off data is never
  // delivered to the server even when the tech is back online.
  if (currentVersion < 28) {
    try { db.runSync(`ALTER TABLE signatures ADD COLUMN company_id TEXT;`); } catch {}
    currentVersion = 28;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '28')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 28 complete (signatures.company_id)');
  }

  // Migration 29: Add local_uri column to inspection_photos.
  //
  // THE PROBLEM THIS SOLVES:
  //   1. Tech captures a photo → stored as file:// URI in inspection_photos.photo_url
  //   2. Background sync uploads the binary → updateRecord() REPLACES photo_url with https:// URL
  //   3. Tech generates PDF offline → toDataUri() tries FileSystem.downloadAsync(https://) → FAILS
  //   4. PDF shows a grey "Photo unavailable" placeholder even though the file is on the device
  //
  // THE FIX:
  //   Store the original file:// path in a separate local_uri column that is NEVER overwritten.
  //   pdfGenerator.ts now checks local_uri first — if the file still exists it encodes it directly.
  //   Only if local_uri is missing or the file has been deleted does it fall back to photo_url (https://).
  if (currentVersion < 29) {
    try { db.runSync(`ALTER TABLE inspection_photos ADD COLUMN local_uri TEXT;`); } catch {}
    currentVersion = 29;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '29')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 29 complete (inspection_photos.local_uri)');
  }

  // Seed inventory from Uptick defect codes on first run
  seedInventoryFromDefectCodes();
}
```

#### `function insertRecord`
```tsx
export function insertRecord(table: string, data: RecordData): number | null {
  try {
    const db = openDatabase();
    const keys = Object.keys(data).map(_safeColumnName);
    const placeholders = keys.map(() => "?").join(", ");
    const values = Object.values(data);
    const result = db.runSync(
      `INSERT INTO ${_safeColumnName(table)} (${keys.join(", ")}) VALUES (${placeholders})`,
      values as SQLite.SQLiteBindValue[],
    );
    return result.lastInsertRowId;
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] insertRecord(${table}) error:`, err);
    return null;
  }
}
```

#### `function updateRecord`
```tsx
export function updateRecord(
  table: string,
  id: string,
  data: RecordData,
): number {
  try {
    const db = openDatabase();
    const keys = Object.keys(data).map(_safeColumnName);
    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = [...Object.values(data), id];
    const result = db.runSync(
      `UPDATE ${_safeColumnName(table)} SET ${setClause} WHERE id = ?`,
      values as SQLite.SQLiteBindValue[],
    );
    return result.changes;
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] updateRecord(${table}, ${id}) error:`, err);
    return 0;
  }
}
```

#### `function deleteRecord`
```tsx
export function deleteRecord(table: string, id: string): number {
  try {
    const db = openDatabase();
    const result = db.runSync(
      `DELETE FROM ${_safeColumnName(table)} WHERE id = ?`,
      [id],
    );
    return result.changes;
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] deleteRecord(${table}, ${id}) error:`, err);
    return 0;
  }
}
```

#### `function getRecord`
```tsx
export function getRecord<T = RecordData>(table: string, id: string): T | null {
  try {
    const db = openDatabase();
    const row = db.getFirstSync<T>(
      `SELECT * FROM ${_safeColumnName(table)} WHERE id = ?`,
      [id],
    );
    return row ?? null;
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getRecord(${table}, ${id}) error:`, err);
    return null;
  }
}
```

#### `function queryRecords`
```tsx
export function queryRecords<T = RecordData>(
  table: string,
  filters: RecordData = {}
```

#### `function queryRecordsIn`
```tsx
export function queryRecordsIn<T = RecordData>(
  table: string,
  column: string,
  ids: string[],
): T[] {
  if (ids.length === 0) return [];
  try {
    const db = openDatabase();
    const safeTable = _safeColumnName(table);
    const safeCol = _safeColumnName(column);
    const placeholders = ids.map(() => "?").join(", ");
    return db.getAllSync<T>(
      `SELECT * FROM ${safeTable} WHERE ${safeCol} IN (${placeholders})`,
      ids as SQLite.SQLiteBindValue[],
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] queryRecordsIn(${table}) error:`, err);
    return [];
  }
}
```

#### `function getJobsForTechnician`
```tsx
export function getJobsForTechnician<T = RecordData>(userId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT j.*, p.name AS property_name, p.address AS property_address,
              p.suburb AS property_suburb, p.state AS property_state,
              p.postcode AS property_postcode,
              p.compliance_status AS property_compliance_status,
              p.site_contact_name, p.site_contact_phone,
              p.access_notes, p.hazard_notes, p.site_note
       FROM jobs j
       LEFT JOIN properties p ON j.property_id = p.id
       WHERE j.assigned_to = ?
         AND j.status != 'cancelled'
       ORDER BY j.scheduled_date ASC, j.priority DESC`,
      [userId],
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getJobsForTechnician(${userId}) error:`, err);
    return [];
  }
}
```

#### `function cleanOldSyncQueueItems`
```tsx
export function cleanOldSyncQueueItems(): void {
  try {
    const db = openDatabase();
    db.runSync(
      `DELETE FROM sync_queue WHERE synced = 1 AND created_at < datetime('now', '-7 days')`,
    );
  } catch (err) {
    console.error("[UMA BUILDING SERVICES DB] cleanOldSyncQueueItems error:", err);
  }
}
```

#### `function clearFailedSyncItems`
```tsx
export function clearFailedSyncItems(tableName: string): void {
  try {
    const db = openDatabase();
    db.runSync(`DELETE FROM sync_queue WHERE table_name = ? AND synced = -1`, [
      tableName,
    ]);
    if (__DEV__)
      console.log(
        `[UMA BUILDING SERVICES DB] Cleared permanently-failed sync queue items for table: ${tableName}`,
      );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] clearFailedSyncItems error:`, err);
  }
}
```

#### `function resetStaleFailedSyncItems`
```tsx
export function resetStaleFailedSyncItems(cooldownMs: number = 24 * 60 * 60 * 1000): number {
  try {
    const db = openDatabase();
    const cutoff = new Date(Date.now() - cooldownMs).toISOString();
    const result = db.runSync(
      `UPDATE sync_queue
       SET synced = 0, retry_count = 0, last_error = NULL
       WHERE synced = -1 AND created_at < ?`,
      [cutoff],
    );
    if (__DEV__ && result.changes > 0) {
      console.log(`[UMA BUILDING SERVICES DB] Gave ${result.changes} stale failed sync item(s) a fresh retry`);
    }
    return result.changes;
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] resetStaleFailedSyncItems error:', err);
    return 0;
  }
}
```

#### `function retryAllFailedSyncItems`
```tsx
export function retryAllFailedSyncItems(): number {
  try {
    const db = openDatabase();
    const result = db.runSync(
      `UPDATE sync_queue SET synced = 0, retry_count = 0, last_error = NULL WHERE synced = -1`,
    );
    if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Manually retried ${result.changes} failed sync item(s)`);
    return result.changes;
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] retryAllFailedSyncItems error:', err);
    return 0;
  }
}
```

#### `function getAssetsForProperty`
```tsx
export function getAssetsForProperty<T = RecordData>(propertyId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT * FROM assets WHERE property_id = ? AND status = 'active' ORDER BY asset_type ASC`,
      [propertyId],
    );
  } catch (err) {
    console.error(
      `[UMA BUILDING SERVICES DB] getAssetsForProperty(${propertyId}) error:`,
      err,
    );
    return [];
  }
}
```

#### `function getDefectsForJob`
```tsx
export function getDefectsForJob<T = RecordData>(jobId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT d.*, a.asset_type, a.location_on_site
       FROM defects d
       LEFT JOIN assets a ON d.asset_id = a.id
       WHERE d.job_id = ?
       ORDER BY CASE d.severity
         WHEN 'critical' THEN 1
         WHEN 'major' THEN 2
         WHEN 'minor' THEN 3
         ELSE 4
       END ASC`,
      [jobId],
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getDefectsForJob(${jobId}) error:`, err);
    return [];
  }
}
```

#### `function getActiveTimeLog`
```tsx
export function getActiveTimeLog(jobId: string, userId: string): { id: string; clock_in: string }
```

#### `function getJobAssetRecord`
```tsx
export function getJobAssetRecord(jobId: string, assetId: string): { id: string; result: string | null; technician_notes: string | null }
```

#### `function addToSyncQueue`
```tsx
export function addToSyncQueue(
  tableName: string,
  recordId: string,
  operation: SyncOperation | 'photo_upload',
  payload: RecordData,
): void {
  try {
    const db = openDatabase();

    // M6 fix: For Update operations, merge into an existing pending row for the same
    // record rather than appending a duplicate. This prevents N network calls when a
    // field is changed N times before the next sync cycle runs.
    // Insert / Delete / photo_upload are always appended as separate entries.
    if (operation === SyncOperation.Update) {
      const existing = db.getFirstSync<{ id: number; payload: string }>(
        `SELECT id, payload FROM sync_queue
         WHERE table_name = ? AND record_id = ? AND operation = ? AND synced = 0
         LIMIT 1`,
        [tableName, recordId, operation],
      );

      if (existing) {
        // Merge: extend the existing payload with the new fields (new fields take precedence)
        let merged: RecordData = {};
        try { merged = JSON.parse(existing.payload) as RecordData; } catch { /* start fresh */ }
        Object.assign(merged, payload);
        db.runSync(
          `UPDATE sync_queue SET payload = ? WHERE id = ?`,
          [JSON.stringify(merged), existing.id],
        );
        return;
      }
    }

    db.runSync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, synced, retry_count)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [tableName, recordId, operation, JSON.stringify(payload)],
    );
  } catch (err) {
    console.error("[UMA BUILDING SERVICES DB] addToSyncQueue error:", err);
  }
}
```

#### `function cancelPendingPhotoUpload`
```tsx
export function cancelPendingPhotoUpload(recordId: string): void {
  try {
    const db = openDatabase();
    db.runSync(
      `UPDATE sync_queue SET synced = 1
       WHERE table_name = 'inspection_photos'
         AND record_id = ?
         AND operation = 'photo_upload'
         AND synced = 0`,
      [recordId],
    );
    if (__DEV__)
      console.log(`[UMA BUILDING SERVICES DB] Cancelled pending photo_upload for record ${recordId}`);
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] cancelPendingPhotoUpload(${recordId}) error:`, err);
  }
}
```

#### `function recordDeletedPhoto`
```tsx
export function recordDeletedPhoto(photoId: string): void {
  try {
    const db = openDatabase();
    db.runSync(
      `INSERT OR IGNORE INTO deleted_photo_ids (id) VALUES (?)`,
      [photoId],
    );
    if (__DEV__)
      console.log(`[UMA BUILDING SERVICES DB] Tombstoned deleted photo ${photoId}`);
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] recordDeletedPhoto(${photoId}) error:`, err);
  }
}
```

#### `function getDeletedPhotoIds`
```tsx
export function getDeletedPhotoIds(): Set<string> {
  try {
    const db = openDatabase();
    const rows = db.getAllSync<{ id: string }>(
      `SELECT id FROM deleted_photo_ids`,
    );
    return new Set(rows.map(r => r.id));
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getDeletedPhotoIds error:`, err);
    return new Set();
  }
}
```

#### `function getPendingSyncItems`
```tsx
export function getPendingSyncItems(maxRetries = 5): SyncQueueItem[] {
  try {
    const db = openDatabase();
    return db.getAllSync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE synced = 0 AND retry_count < ? ORDER BY created_at ASC`,
      [maxRetries],
    );
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] getPendingSyncItems error:', err);
    return [];
  }
}
```

#### `function getFailedSyncItems`
```tsx
export function getFailedSyncItems(): SyncQueueItem[] {
  try {
    const db = openDatabase();
    return db.getAllSync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE synced = -1 ORDER BY created_at DESC`,
    );
  } catch (err) {
    console.error("[UMA BUILDING SERVICES DB] getFailedSyncItems error:", err);
    return [];
  }
}
```

#### `function markSyncItemComplete`
```tsx
export function markSyncItemComplete(id: number): void {
  try {
    const db = openDatabase();
    db.runSync(`UPDATE sync_queue SET synced = 1 WHERE id = ?`, [id]);
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] markSyncItemComplete(${id}) error:`, err);
  }
}
```

#### `function incrementSyncRetry`
```tsx
export function incrementSyncRetry(
  id: number,
  errorMessage: string,
  maxRetries = 5,
): void {
  try {
    const db = openDatabase();
    const item = db.getFirstSync<{ retry_count: number }>(
      `SELECT retry_count FROM sync_queue WHERE id = ?`,
      [id],
    );
    if (!item) return;

    const newCount = (item.retry_count ?? 0) + 1;
    if (newCount >= maxRetries) {
      // Permanently mark as failed — will not be retried
      db.runSync(
        `UPDATE sync_queue SET retry_count = ?, last_error = ?, synced = -1 WHERE id = ?`,
        [newCount, errorMessage, id],
      );
      console.warn(
        `[UMA BUILDING SERVICES DB] Sync item ${id} permanently failed after ${newCount} retries: ${errorMessage}`,
      );
    } else {
      db.runSync(
        `UPDATE sync_queue SET retry_count = ?, last_error = ? WHERE id = ?`,
        [newCount, errorMessage, id],
      );
    }
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] incrementSyncRetry(${id}) error:`, err);
  }
}
```

#### `function upsertRecord`
```tsx
export function upsertRecord(table: string, data: RecordData): void {
  const _tryUpsert = (db: SQLite.SQLiteDatabase, safeTable: string, d: RecordData): void => {
    const keys = Object.keys(d).map(_safeColumnName);
    const placeholders = keys.map(() => "?").join(", ");
    const values = Object.values(d);
    const setClauses = keys
      .filter((k) => k !== "id")
      .map((k) => `${k} = excluded.${k}`)
      .join(", ");

    if (setClauses.length === 0) {
      db.runSync(
        `INSERT OR IGNORE INTO ${safeTable} (${keys.join(", ")}) VALUES (${placeholders})`,
        values as SQLite.SQLiteBindValue[],
      );
    } else {
      db.runSync(
        `INSERT INTO ${safeTable} (${keys.join(", ")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${setClauses}`,
        values as SQLite.SQLiteBindValue[],
      );
    }
  };

  try {
    const db = openDatabase();
    const safeTable = _safeColumnName(table);
    _tryUpsert(db, safeTable, data);
  } catch (err) {
    // Use String(err) not err.message — expo-sqlite wraps native errors, so the
    // root cause (e.g. 'table X has no column named Y') is in the full string,
    // not in the top-level .message (which is just 'NativeDatabase.prepareSync rejected').
    const fullErr = String(err);
    const msg = err instanceof Error ? err.message : fullErr;
    const isColumnError = fullErr.includes('no column named') ||
                          fullErr.includes('has no column') ||
                          msg.includes('no column named');
    // Guard: if Supabase has a new column that doesn't exist in local SQLite yet,
    // retry with only the columns that the local table actually knows about.
    // This prevents any future remote schema addition from crashing the entire sync.
    if (isColumnError) {
      try {
        const db = openDatabase();
        const safeTable = _safeColumnName(table);
        // Get the list of columns that actually exist in this local table
        const colRows = db.getAllSync<{ name: string }>(`PRAGMA table_info(${safeTable})`);
        const localCols = new Set(colRows.map(r => r.name));
        // Filter data down to only known columns
        const safeData: RecordData = {};
        for (const [k, v] of Object.entries(data)) {
          if (localCols.has(k)) safeData[k] = v;
        }
        if (__DEV__) {
          const skipped = Object.keys(data).filter(k => !localCols.has(k));
          if (skipped.length > 0) console.warn(`[UMA BUILDING SERVICES DB] upsertRecord(${table}): skipping unknown columns [${skipped.join(', ')}] — add a migration to include them`);
        }
        _tryUpsert(db, safeTable, safeData);
      } catch (retryErr) {
        console.error(`[UMA BUILDING SERVICES DB] upsertRecord(${table}) retry error:`, retryErr);
      }
    } else {
      console.error(`[UMA BUILDING SERVICES DB] upsertRecord(${table}) error:`, err);
    }
  }
}
```

#### `function getJobById`
```tsx
export function getJobById<T = RecordData>(jobId: string): T | null {
  try {
    const db = openDatabase();
    return (
      db.getFirstSync<T>(
        `SELECT j.*,
              p.name            AS property_name,
              p.address         AS property_address,
              p.suburb          AS property_suburb,
              p.state           AS property_state,
              p.postcode        AS property_postcode,
              p.site_contact_name,
              p.site_contact_phone,
              p.access_notes,
              p.hazard_notes,
              p.site_note,
              p.compliance_status AS property_compliance_status
       FROM jobs j
       LEFT JOIN properties p ON j.property_id = p.id
       WHERE j.id = ?`,
        [jobId],
      ) ?? null
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getJobById(${jobId}) error:`, err);
    return null;
  }
}
```

#### `function getAssetsWithJobResults`
```tsx
export function getAssetsWithJobResults<T = RecordData>(
  jobId: string,
  propertyId: string,
): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      // Uses MAX(actioned_at) to select the single most-recent job_assets row per asset.
      // ORDER BY inside IN() is not guaranteed in older SQLite versions — this GROUP BY
      // approach is portable and reliable. Prevents duplicate rows when rapid taps
      // create multiple job_assets entries for the same asset+job combination.
      `SELECT a.*,
              ja.id              AS job_asset_id,
              ja.result,
              ja.defect_reason,
              ja.technician_notes,
              ja.technician_notes AS inspection_notes,
              ja.checklist_data,
              ja.is_compliant,
              ja.actioned_at
       FROM assets a
       LEFT JOIN (
         SELECT jb.*
         FROM job_assets jb
         INNER JOIN (
           SELECT asset_id, MAX(actioned_at) AS latest_at
           FROM job_assets
           WHERE job_id = ?
           GROUP BY asset_id
         ) latest ON jb.asset_id = latest.asset_id AND jb.actioned_at = latest.latest_at
         WHERE jb.job_id = ?
       ) ja ON a.id = ja.asset_id
       WHERE a.property_id = ?
         AND a.status = 'active'
       ORDER BY a.asset_type ASC, COALESCE(a.asset_ref, '') ASC`,
      [jobId, jobId, propertyId],
    );
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] getAssetsWithJobResults error:', err);
    return [];
  }
}
```

#### `function getJobsForProperty`
```tsx
export function getJobsForProperty<T = RecordData>(
  propertyId: string,
  limit = 5,
): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT j.*, u.full_name AS technician_name
       FROM jobs j
       LEFT JOIN users u ON j.assigned_to = u.id
       WHERE j.property_id = ?
       ORDER BY j.scheduled_date DESC, j.created_at DESC
       LIMIT ?`,
      [propertyId, limit],
    );
  } catch (err) {
    console.error(
      `[UMA BUILDING SERVICES DB] getJobsForProperty(${propertyId}) error:`,
      err,
    );
    return [];
  }
}
```

#### `function getTimeLogsForJob`
```tsx
export function getTimeLogsForJob<T = RecordData>(jobId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT * FROM time_logs WHERE job_id = ? ORDER BY clock_in ASC`,
      [jobId],
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getTimeLogsForJob(${jobId}) error:`, err);
    return [];
  }
}
```

#### `function getSignatureForJob`
```tsx
export function getSignatureForJob<T = RecordData>(jobId: string): T | null {
  try {
    const db = openDatabase();
    return (
      db.getFirstSync<T>(`SELECT * FROM signatures WHERE job_id = ?`, [
        jobId,
      ]) ?? null
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getSignatureForJob(${jobId}) error:`, err);
    return null;
  }
}
```

#### `function getPhotosForJob`
```tsx
export function getPhotosForJob<T = RecordData>(jobId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT * FROM inspection_photos WHERE job_id = ? ORDER BY uploaded_at ASC`,
      [jobId],
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getPhotosForJob(${jobId}) error:`, err);
    return [];
  }
}
```

#### `function getServiceHistoryForAsset`
```tsx
export function getServiceHistoryForAsset<T = RecordData>(
  assetId: string,
  limit = 5,
): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT ja.*, j.scheduled_date, j.job_type, j.status AS job_status,
              u.full_name AS technician_name
       FROM job_assets ja
       LEFT JOIN jobs j ON ja.job_id = j.id
       LEFT JOIN users u ON j.assigned_to = u.id
       WHERE ja.asset_id = ?
       ORDER BY j.scheduled_date DESC
       LIMIT ?`,
      [assetId, limit],
    );
  } catch (err) {
    console.error(
      `[UMA BUILDING SERVICES DB] getServiceHistoryForAsset(${assetId}) error:`,
      err,
    );
    return [];
  }
}
```

#### `function getJobStatus`
```tsx
export function getJobStatus(jobId: string): { status: string; updated_at: string }
```

#### `function getDefectsForAsset`
```tsx
export function getDefectsForAsset<T = RecordData>(assetId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT d.*, j.scheduled_date
       FROM defects d
       LEFT JOIN jobs j ON d.job_id = j.id
       WHERE d.asset_id = ?
       ORDER BY d.created_at DESC`,
      [assetId],
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getDefectsForAsset(${assetId}) error:`, err);
    return [];
  }
}
```

#### `function getAllDefects`
```tsx
export function getAllDefects<T = RecordData>(status?: string): T[] {
  try {
    const db = openDatabase();
    // Security: use parameterised query — never interpolate status string directly into SQL
    if (status) {
      return db.getAllSync<T>(
        `SELECT d.*,
                a.asset_type, a.location_on_site,
                p.name AS property_name,
                j.scheduled_date, j.job_type
         FROM defects d
         LEFT JOIN assets a ON d.asset_id = a.id
         LEFT JOIN properties p ON d.property_id = p.id
         LEFT JOIN jobs j ON d.job_id = j.id
         WHERE d.status = ?
         ORDER BY d.created_at DESC`,
        [status],
      );
    }
    return db.getAllSync<T>(
      `SELECT d.*,
              a.asset_type, a.location_on_site,
              p.name AS property_name,
              j.scheduled_date, j.job_type
       FROM defects d
       LEFT JOIN assets a ON d.asset_id = a.id
       LEFT JOIN properties p ON d.property_id = p.id
       LEFT JOIN jobs j ON d.job_id = j.id
       ORDER BY d.created_at DESC`,
    );
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] getAllDefects error:', err);
    return [];
  }
}
```

#### `function getDefectById`
```tsx
export function getDefectById<T = RecordData>(defectId: string): T | null {
  try {
    const db = openDatabase();
    return db.getFirstSync<T>(
      `SELECT d.*,
              a.asset_type, a.location_on_site, a.serial_number,
              p.name AS property_name,
              j.scheduled_date, j.job_type, j.id AS job_id_resolved
       FROM defects d
       LEFT JOIN assets a ON d.asset_id = a.id
       LEFT JOIN properties p ON d.property_id = p.id
       LEFT JOIN jobs j ON d.job_id = j.id
       WHERE d.id = ?`,
      [defectId],
    ) ?? null;
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getDefectById(${defectId}) error:`, err);
    return null;
  }
}
```

#### `function seedInventoryFromDefectCodes`
```tsx
export function seedInventoryFromDefectCodes(): void {
  try {
    const db = openDatabase();
    const count = db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM inventory_items');
    if (count && count.n > 0) return; // Already seeded — never overwrites existing data

    const pricedCodes = DEFECT_CODES.filter(d => d.quote_price !== undefined);
    const now = new Date().toISOString();

    db.withTransactionSync(() => {
      for (const code of pricedCodes) {
        const id = generateUUID();
        db.runSync(
          `INSERT OR IGNORE INTO inventory_items (id, name, description, price, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [id, `[${code.code.toUpperCase()}] ${code.category}`, code.description.substring(0, 120), code.quote_price!, now],
        );
      }
    });

    if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Seeded ${pricedCodes.length} inventory items from Uptick codes`);
  } catch (err) {
    // Non-fatal — inventory seeding is best-effort
    console.warn('[UMA BUILDING SERVICES DB] seedInventoryFromDefectCodes failed:', err);
  }
}
```

#### `function getUnreadNotificationCount`
```tsx
export function getUnreadNotificationCount(userId: string): number {
  try {
    const db = openDatabase();
    const res = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId],
    );
    return res?.count ?? 0;
  } catch {
    return 0;
  }
}
```

#### `function clearDatabase`
```tsx
export function clearDatabase(): void {
  try {
    const db = openDatabase();
    const tables = [
      'users', 'properties', 'assets', 'jobs', 'job_assets', 
      'defects', 'inspection_photos', 'signatures', 'time_logs',
      'quotes', 'quote_items', 'notifications', 'sync_queue'
    ];
    
    // Use WAL checkpointing first to ensure all pending operations commit
    db.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
    
    for (const table of tables) {
      try {
        db.runSync(`DELETE FROM ${_safeColumnName(table)};`);
      } catch (err) {
        console.warn(`[UMA BUILDING SERVICES DB] Failed to wipe ${table}:`, err);
      }
    }
    
    // We explicitly leave `asset_type_definitions`, `defect_codes`, `inventory_items`, 
    // and `deleted_photo_ids` intact because they are global dictionary/tombstone tables 
    // and redownloading them on every login is inefficient.
    
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Database wiped successfully for sign-out');
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] clearDatabase fatal error:', err);
  }
}
```

#### `type RecordData`
```tsx
export type RecordData = Record<string, string | number | boolean | null>;

/**
 * Inserts a new row into the given table.
 * Column names are validated to prevent SQL injection.
 * @returns The inserted row id or null on failure
 */
export function insertRecord(table: string, data: RecordData): number | null {
  try {
    const db = openDatabase();
    const keys = Object.keys(data).map(_safeColumnName);
    const placeholders = keys.map(() => "?").join(", ");
    const values = Object.values(data);
    const result = db.runSync(
      `INSERT INTO ${_safeColumnName(table)} (${keys.join(", ")}) VALUES (${placeholders})`,
      values as SQLite.SQLiteBindValue[],
    );
    return result.lastInsertRowId;
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] insertRecord(${table}) error:`, err);
    return null;
  }
}
```

*Size: **2037** lines of code.*

---

## 📄 `lib/notifications.ts`

> **Description:** UMA BUILDING SERVICES — Daily Summary Notification Scheduler Schedules a local "Job summary" notification at 6:00 PM each day. Requires expo-notifications (already installed). Only schedules if the user has granted permission.
>
> **What we expect from it:** Core business logic module. **We expect this to handle data processing, database interactions, or external integrations.**

### Core Code Logic & Implementations:

#### `function requestNotificationPermission`
```tsx
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}
```

#### `function scheduleDailySummaryNotification`
```tsx
export async function scheduleDailySummaryNotification(
  jobCount: number,
  pendingCount: number
): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Cancel existing daily summary notification first
    await cancelDailySummaryNotification();

    if (jobCount === 0) return; // Nothing to notify about

    const content: Notifications.NotificationContentInput = {
      title: '📋 UMA BUILDING SERVICES Daily Summary',
      body: jobCount === 1
        ? `You have 1 job scheduled today.${pendingCount > 0 ? ` ${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync.` : ' All synced ✓'}`
        : `You have ${jobCount} jobs scheduled today.${pendingCount > 0 ? ` ${pendingCount} unsynced change${pendingCount > 1 ? 's' : ''}.` : ' All synced ✓'}`,
      data: { type: 'daily_summary' },
      sound: 'default',
    };

    const trigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 18,
      minute: 0,
    };

    await Notifications.scheduleNotificationAsync({ content, trigger });
    if (__DEV__) console.log('[UMA BUILDING SERVICES Notifications] Daily summary scheduled for 18:00');
  } catch (err) {
    console.warn('[UMA BUILDING SERVICES Notifications] scheduleDailySummaryNotification error:', err);
  }
}
```

#### `function cancelDailySummaryNotification`
```tsx
export async function cancelDailySummaryNotification(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const daily = scheduled.filter(n => n.content.data?.type === 'daily_summary');
    await Promise.all(daily.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch (err) {
    console.warn('[UMA BUILDING SERVICES Notifications] cancelDailySummaryNotification error:', err);
  }
}
```

#### `function scheduleJobReminder`
```tsx
export async function scheduleJobReminder(
  jobId: string,
  propertyName: string,
  scheduledDate: string,
  scheduledTime: string | null
): Promise<void> {
  try {
    if (!scheduledTime) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const [year, month, day] = scheduledDate.split('-').map(Number);
    const [hour, minute]     = scheduledTime.split(':').map(Number);
    const jobDt       = new Date(year, month - 1, day, hour, minute, 0);
    const reminderDt  = new Date(jobDt.getTime() - 30 * 60 * 1000);

    if (reminderDt < new Date()) return;

    // Cancel old reminder for this job
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const old = scheduled.filter(n => n.content.data?.jobId === jobId && n.content.data?.type === 'job_reminder');
    await Promise.all(old.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Job Starting Soon',
        body:  `${propertyName || 'Your next job'} starts in 30 minutes.`,
        data:  { jobId, type: 'job_reminder' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDt,
      },
    });
    if (__DEV__) console.log(`[UMA BUILDING SERVICES Notifications] Reminder scheduled for ${jobId}`);
  } catch (err) {
    console.warn('[UMA BUILDING SERVICES Notifications] scheduleJobReminder error:', err);
  }
}
```

#### `function configureNotificationHandler`
```tsx
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
```

*Size: **118** lines of code.*

---

## 📄 `lib/pdfConstants.ts`

> **Description:** lib/pdfConstants.ts Shared constants between pdfGenerator.ts and reportTemplate.ts. Pulled into its own module because pdfGenerator.ts imports buildReportHtml from reportTemplate.ts — if reportTemplate.ts tried to import FALLBACK_IMG back from pdfGenerator.ts, that would be a circular import. Keeping shared constants here avoids the cycle entirely.
>
> **What we expect from it:** Core business logic module. **We expect this to handle data processing, database interactions, or external integrations.**

### Core Code Logic & Implementations:

#### `const FALLBACK_IMG`
```tsx
export const FALLBACK_IMG =
```

*Size: **14** lines of code.*

---

## 📄 `lib/pdfGenerator.ts`

> **Description:** lib/pdfGenerator.ts Generates and shares a PDF service report for a completed job. Key improvements: - All images converted to data: URIs before HTML is built (expo-print WKWebView sandbox cannot load file:// or https:// URIs) - Sequential encoding with per-image error isolation - Defect photos prioritised in the MAX_ENCODED_PHOTOS budget - Signature encoded as JPEG (3× smaller than PNG) - Temp files cleaned up in finally blocks - Detailed progress stages for UI feedback Size presets (encode at ~1.2–1.5× CSS display size): CSS display          Encode at 72 × 72  (thumb)  →  110px wide 220 × 165 (defect) →  320px wide 64px tall (sig)    →  260px wide
>
> **What we expect from it:** Core business logic module. **We expect this to handle data processing, database interactions, or external integrations.**

### Core Code Logic & Implementations:

#### `function generateJobReport`
```tsx
export async function generateJobReport(
  jobId: string,
  onProgress?: ReportProgressCallback
): Promise<{ pdfUri: string; html: string; title: string; reportUrl: string | null; completed: boolean; wasCacheHit: boolean }
```

#### `type ReportProgressCallback`
```tsx
export type ReportProgressCallback = (stage: ReportStage, detail?: string) => void;

export type ReportStage =
  | 'fetching_data'
  | 'processing_photos'
  | 'building_html'
  | 'generating_pdf'
  | 'uploading'
  | 'sharing'
  | 'cached';

// ─── Image size presets ────────────────────────────────────────────────────────
// CSS sizes in reportTemplate.ts:
//   .photo-thumb:  72 × 72   → encode at 110px (1.53×)
//   .photo-defect: 220 × 165 → encode at 320px (1.45×)
//   .sig-img:      max-height 64px → encode at 260px wide

const THUMB_W  = 110;
const THUMB_Q  = 0.60;
const DEFECT_W = 320;
const DEFECT_Q = 0.70;
const SIG_W    = 260;
const SIG_Q    = 0.80;

// Defect/fail photos consume budget first; pass thumbnails fill the remainder.
const MAX_ENCODED_PHOTOS = 60;

// How many photos to encode concurrently.
// ImageManipulator is a native operation and runs truly parallel — 5 concurrent
// gives ~4-5x speedup over sequential with no quality change.
const ENCODE_CONCURRENCY = 5;

const PDF_TIMEOUT_MS       = 90_000;
const PDF_STAMP_TIMEOUT_MS = 30_000;

// ─── Utilities ─────────────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`[UMA BUILDING SERVICES] Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}
```

#### `type ReportStage`
```tsx
export type ReportStage =
  | 'fetching_data'
  | 'processing_photos'
  | 'building_html'
  | 'generating_pdf'
  | 'uploading'
  | 'sharing'
  | 'cached';

// ─── Image size presets ────────────────────────────────────────────────────────
// CSS sizes in reportTemplate.ts:
//   .photo-thumb:  72 × 72   → encode at 110px (1.53×)
//   .photo-defect: 220 × 165 → encode at 320px (1.45×)
//   .sig-img:      max-height 64px → encode at 260px wide

const THUMB_W  = 110;
const THUMB_Q  = 0.60;
const DEFECT_W = 320;
const DEFECT_Q = 0.70;
const SIG_W    = 260;
const SIG_Q    = 0.80;

// Defect/fail photos consume budget first; pass thumbnails fill the remainder.
const MAX_ENCODED_PHOTOS = 60;

// How many photos to encode concurrently.
// ImageManipulator is a native operation and runs truly parallel — 5 concurrent
// gives ~4-5x speedup over sequential with no quality change.
const ENCODE_CONCURRENCY = 5;

const PDF_TIMEOUT_MS       = 90_000;
const PDF_STAMP_TIMEOUT_MS = 30_000;

// ─── Utilities ─────────────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`[UMA BUILDING SERVICES] Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}
```

*Size: **822** lines of code.*

---

## 📄 `lib/photoUpload.ts`

> **Description:** lib/photoUpload.ts Handles uploading locally-captured photos to Supabase Storage and keeping the local SQLite record in sync with the resulting public URL. Fix summary (this revision): 1. uploadAsync httpMethod changed from POST → PUT (Supabase Storage upsert endpoint) 2. getValidLocalUri applied to localUri before upload to handle stale Expo Go paths 3. uploaded_by included in the SyncOperation.Insert payload (was silently missing, causing Supabase FK constraint failures on servers with NOT NULL uploaded_by) 4. processPhotoQueue: early-exit if no pending photo tasks (avoids unnecessary work) 5. queuePhotoUpload: recordId fallback made explicit (was relying on 'new' string)
>
> **What we expect from it:** Core business logic module. **We expect this to handle data processing, database interactions, or external integrations.**

### Core Code Logic & Implementations:

#### `function uploadPhoto`
```tsx
export async function uploadPhoto(
  localUri: string,
  jobId: string,
  assetId?: string,
): Promise<string | null> {
  try {
    // Normalise path for the current Expo Go session — stale absolute paths fail silently
    const resolvedUri = getValidLocalUri(localUri);

    const timestamp = Date.now();
    const random    = Math.random().toString(36).substring(7);
    const fileName  = `${timestamp}-${random}.jpg`;
    const filePath  = `jobs/${jobId}/${fileName}`;

    const session  = await supabase.auth.getSession();
    const token    = session.data.session?.access_token;
    const anonKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

    if (!supabaseUrl) {
      throw new Error('[PhotoUpload] EXPO_PUBLIC_SUPABASE_URL is not set');
    }

    const uploadUrl = `${supabaseUrl}/storage/v1/object/job-photos/${filePath}`;

    // PUT is required for Supabase Storage binary upserts — POST returns 405
    const uploadResult = await FileSystem.uploadAsync(uploadUrl, resolvedUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token ?? anonKey}`,
        apikey: anonKey,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
    });

    if (uploadResult.status !== 200 && uploadResult.status !== 201) {
      throw new Error(
        `[PhotoUpload] Upload failed (status ${uploadResult.status}): ${uploadResult.body}`,
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('job-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('[PhotoUpload] uploadPhoto error:', err);
    return null;
  }
}
```

#### `function queuePhotoUpload`
```tsx
export function queuePhotoUpload(
  localUri: string,
  jobId: string,
  assetId?: string,
  recordId?: string,
  defectId?: string,
): void {
  if (!recordId) {
    console.warn('[PhotoUpload] queuePhotoUpload called without recordId — skipping queue');
    return;
  }
  const payload = { localUri, jobId, assetId, recordId, defectId };
  addToSyncQueue('inspection_photos', recordId, 'photo_upload', payload);
}
```

#### `function processPhotoQueue`
```tsx
export async function processPhotoQueue(currentUserId: string): Promise<void> {
  try {
    const pending    = getPendingSyncItems();
    const photoTasks = pending.filter(i => String(i.operation) === 'photo_upload');

    if (photoTasks.length === 0) return;

    if (__DEV__) console.log(`[PhotoUpload] Processing ${photoTasks.length} queued photo(s) in batches of ${UPLOAD_CONCURRENCY}`);

    // H1: Guard — don't attempt photo sync without a valid user ID.
    // An empty uploaded_by value causes Supabase FK constraint failures silently.
    if (!currentUserId) {
      if (__DEV__) console.warn('[PhotoUpload] No authenticated user — deferring photo queue until next sync');
      return;
    }

    // Process in parallel batches — 3 concurrent uploads is safe on mobile connections
    for (let i = 0; i < photoTasks.length; i += UPLOAD_CONCURRENCY) {
      const batch = photoTasks.slice(i, i + UPLOAD_CONCURRENCY);

      await Promise.all(batch.map(async task => {
        // M3: Skip permanently-failed photo tasks (same retry limit as regular sync items)
        if ((task.retry_count ?? 0) >= MAX_PHOTO_RETRIES) {
          if (__DEV__) console.warn(`[PhotoUpload] Task ${task.id} has exceeded max retries — skipping permanently`);
          return;
        }

        let payload: {
          localUri: string;
          jobId: string;
          assetId?: string;
          recordId?: string;
          defectId?: string;
        };

        try {
          payload = JSON.parse(task.payload);
        } catch {
          console.warn('[PhotoUpload] Malformed task payload, skipping:', task.id);
          markSyncItemComplete(task.id);
          return;
        }

        if (__DEV__) console.log(`[PhotoUpload] Uploading photo for job ${payload.jobId}`);

        const publicUrl = await uploadPhoto(payload.localUri, payload.jobId, payload.assetId);

        if (publicUrl && payload.recordId) {
          // Update local SQLite row with the now-public URL
          updateRecord('inspection_photos', payload.recordId, { photo_url: publicUrl });

          // Read caption from the local SQLite row so it's included in the Supabase row.
          // Bug fix: caption was previously omitted, causing captions to be local-only.
          const localRow = getRecord<{ caption: string | null; company_id: string | null }>('inspection_photos', payload.recordId);

          // Insert the row into Supabase via sync queue.
          // uploaded_by AND company_id are required — include both so Supabase RLS is satisfied.
          addToSyncQueue('inspection_photos', payload.recordId, SyncOperation.Insert, {
            id:          payload.recordId,
            job_id:      payload.jobId,
            asset_id:    payload.assetId ?? null,
            defect_id:   payload.defectId ?? null,
            photo_url:   publicUrl,
            caption:     localRow?.caption ?? null,
            company_id:  localRow?.company_id ?? null,
            uploaded_at: new Date().toISOString(),
            uploaded_by: currentUserId,
          });

          markSyncItemComplete(task.id);

          if (__DEV__) console.log(`[PhotoUpload] Uploaded: ${publicUrl}`);
        } else {
          if (__DEV__) console.log(`[PhotoUpload] Upload failed for task ${task.id} — will retry next cycle`);
          incrementSyncRetry(task.id, 'Upload failed');
        }
      }));
    }
  } catch (err) {
    console.error('[PhotoUpload] processPhotoQueue error:', err);
  }
}
```

#### `function cleanupLocalPhotos`
```tsx
export async function cleanupLocalPhotos(): Promise<void> {
  try {
    const cutoffMs   = LOCAL_PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - cutoffMs).toISOString();

    // Find all inspection_photos rows that:
    //   - Have a local_uri still set (haven't been cleaned up yet)
    //   - Have an https:// photo_url (upload confirmed successful)
    const candidates = queryRecords<{
      id: string;
      local_uri: string;
      photo_url: string;
      job_id: string;
    }>('inspection_photos', {});

    // Filter in JS — queryRecords uses simple equality matching so we do
    // the richer checks (LIKE, date compare) manually. The set is small.
    const uploaded = candidates.filter(
      r => r.local_uri &&
           r.photo_url &&
           r.photo_url.startsWith('https://')
    );

    if (uploaded.length === 0) return;

    // Get the unique job IDs and check their completion date
    const jobIds = [...new Set(uploaded.map(r => r.job_id))];
    const eligibleJobIds = new Set<string>();

    for (const jobId of jobIds) {
      const job = queryRecords<{ id: string; status: string; updated_at: string }>(
        'jobs', { id: jobId }
      )[0];
      if (!job) continue;
      // Only clean up photos for completed/cancelled jobs older than the retention window
      const isEligibleStatus = job.status === 'completed' || job.status === 'cancelled';
      const isOldEnough      = job.updated_at < cutoffDate;
      if (isEligibleStatus && isOldEnough) {
        eligibleJobIds.add(jobId);
      }
    }

    if (eligibleJobIds.size === 0) return;

    const toClean = uploaded.filter(r => eligibleJobIds.has(r.job_id));
    let deletedCount = 0;

    for (const photo of toClean) {
      try {
        const localPath = getValidLocalUri(photo.local_uri);
        const info = await FileSystem.getInfoAsync(localPath);
        if (info.exists) {
          await FileSystem.deleteAsync(localPath, { idempotent: true });
          deletedCount++;
        }
      } catch (e) {
        // File already gone or path invalid — not a problem, just clear the column
        if (__DEV__) console.warn(`[PhotoCleanup] Could not delete ${photo.local_uri}:`, e);
      }
      // Regardless of whether the file existed, clear local_uri so we don't
      // attempt deletion again on the next sync cycle.
      updateRecord('inspection_photos', photo.id, { local_uri: null });
    }

    if (deletedCount > 0 && __DEV__) {
      console.log(
        `[PhotoCleanup] Deleted ${deletedCount} local photo file(s) for ${
          eligibleJobIds.size
        } completed job(s) older than ${LOCAL_PHOTO_RETENTION_DAYS} days`
      );
    }
  } catch (err) {
    // Never crash the sync cycle — cleanup is best-effort
    console.warn('[PhotoCleanup] cleanupLocalPhotos error:', err);
  }
}
```

*Size: **322** lines of code.*

---

## 📄 `lib/quoteTemplate.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core business logic module. **We expect this to handle data processing, database interactions, or external integrations.**

### Core Code Logic & Implementations:

#### `function generateQuoteHtml`
```tsx
export function generateQuoteHtml(data: QuoteReportData): string {
  const { job, defects, total_amount, reportId } = data;
  
  const propName    = sanitizeForHtml(job.property_name    ?? '—', MAX_LENGTHS.name);
  const address     = sanitizeForHtml([job.property_address, job.property_suburb, job.property_state, job.property_postcode].filter(Boolean).join(', '), MAX_LENGTHS.address);
  const siteContact = sanitizeForHtml(job.site_contact_name ?? 'Not provided', MAX_LENGTHS.name);
  const refNum      = shortId(job.id, 6);
  const dateStr     = fmtDateShort(new Date().toISOString());

  const crit = defects.filter(d => d.severity === 'critical');
  const maj  = defects.filter(d => d.severity === 'major');
  const min  = defects.filter(d => d.severity === 'minor');

  const renderGroup = (title: string, items: Defect[], cls: string) => {
    if (items.length === 0) return '';
    const rows = items.map(d => `
      <div class="t-row">
        <div class="c-id">${shortId(d.id, 5)}</div>
        <div class="c-desc">${sanitizeForHtml(d.description || 'Defect remediation', MAX_LENGTHS.notes)}</div>
        <div class="c-price">${fmtCurrency(d.quote_price || 0)}</div>
      </div>
    `).join('');
    
    return `
      <div class="group-hdr ${cls}">${title}</div>
      ${rows}
    `;
  };

  const gst = total_amount * 0.1;
  const grandTotal = total_amount + gst;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${CSS}</style>
</head>
<body>
  <div class="section first">
    ${logoHtml(shortId(reportId, 6), data.company)}

    <div class="nb">
      <div class="sec-bar first">Quotation Details</div>
      <div class="info-grid">
        <div class="info-cell">
          <div class="info-label">Site / Property</div>
          <div class="info-val">${propName}</div>
          <div class="info-val muted" style="margin-top:4px;white-space:pre-line">${address || '—'}</div>
        </div>
        <div class="info-cell">
          <div class="info-label">Site Contact</div>
          <div class="info-val">${siteContact}</div>
        </div>
        <div class="info-cell">
          <div class="info-label">Job Reference</div>
          <div class="info-val">${refNum}</div>
        </div>
        <div class="info-cell accent">
          <div class="info-label">Quote Date</div>
          <div class="info-val">${dateStr}</div>
        </div>
      </div>
    </div>

    <div class="nb">
      <div class="sec-bar">Proposed Works</div>
      <div class="tbl-wrap">
        ${renderGroup('Immediate / Critical Repairs', crit, 'crit')}
        ${renderGroup('Major Defect Remediation', maj, 'maj')}
        ${renderGroup('Minor Defect Remediation', min, 'min')}
        
        ${defects.length === 0 ? '<div style="padding:20px;text-align:center;color:#64748B;font-size:12px;">No items in quote</div>' : ''}

        <div class="totals-row">
          <div>Subtotal (excl. GST)</div>
          <div style="min-width:80px;text-align:right;font-weight:600">${fmtCurrency(total_amount)}</div>
        </div>
        <div class="totals-row">
          <div>GST (10%)</div>
          <div style="min-width:80px;text-align:right">${fmtCurrency(gst)}</div>
        </div>
        <div class="totals-row grand">
          <div class="grand-lbl">Total Quote</div>
          <div class="grand-val">${fmtCurrency(grandTotal)}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
```

#### `type QuoteReportData`
```tsx
export interface QuoteReportData {
  job: JoinedJob;
  defects: Defect[];
  total_amount: number;
  reportId: string;
  company?: Record<string, string | null | undefined>;
}
```

*Size: **237** lines of code.*

---

## 📄 `lib/reportTemplate.ts`

> **Description:** lib/reportTemplate.ts Generates the HTML that expo-print converts to a professional A4 PDF. Design: Clean corporate inspection report - Navy/slate header with orange accent brand bar - Structured info grid with clear hierarchy - Colour-coded defect severity legend - Asset rows: PASS (green) / FAIL (red) / N/T (grey) pills - Defect boxes with full photo grids - Signature block with typed name fallback - Fixed footer on every page Photo handling: - Only data: URIs are embedded (safe for expo-print sandbox) - All images use explicit px dimensions (WKWebView collapses % sizes) - Photos that failed to encode (FALLBACK_IMG) render as a labelled "Photo unavailable" placeholder rather than an invisible blank box — see isRealPhoto() below.
>
> **What we expect from it:** Core business logic module. **We expect this to handle data processing, database interactions, or external integrations.**

### Core Code Logic & Implementations:

#### `function buildReportHtml`
```tsx
export function buildReportHtml(data: ReportData): string {
  const { approvedQuote, quoteItems, inventory, reportId, job } = data;
  const propertyName = job.property_name ?? reportId;

  const hasQuote = Boolean(approvedQuote && quoteItems?.length && inventory);
  const quotePg = hasQuote
    ? buildQuotePage(
        approvedQuote!,
        quoteItems!,
        inventory!,
        reportId,
        data.company,
      )
    : "";

  const page1 = buildPage1(data);
  const maintPg = buildMaintPage(data);
  // WKWebView (expo-print) renders any leading whitespace as blank page content.
  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=794"/>
  <title>Service Report — ${propertyName}</title>
  <style>${CSS}</style>
</head><body>${page1}${maintPg}${quotePg}</body></html>`;
}
```

#### `type AssetWithResult`
```tsx
export interface AssetWithResult {
  id: string;
  property_id: string;
  asset_type: string;
  /** Short technician reference number for this asset at the site (e.g. '001', '040') */
  asset_ref: string | null;
  variant: string | null;
  description: string | null;
  location_on_site: string | null;
  serial_number: string | null;
  barcode_id: string | null;
  install_date: string | null;
  last_service_date: string | null;
  next_service_date: string | null;
  status: string;
  created_at: string;
  result: "pass" | "fail" | "not_tested" | null;
  defect_reason: string | null;
  technician_notes: string | null;
  inspection_notes: string | null;
  actioned_at: string | null;
}
```

#### `type ReportData`
```tsx
export interface ReportData {
  job: JoinedJob;
  assets: AssetWithResult[];
  defects: Defect[];
  signature: Signature | null;
  photos: InspectionPhoto[];
  timeLogs: TimeLog[];
  techName: string;
  /** Full technician User record — used for FPAS/licence fields on the cover page (AS1851) */
  tech?: TechUser;
  reportId: string;
  approvedQuote?: Quote;
  quoteItems?: QuoteItem[];
  inventory?: InventoryItem[];
  company: Record<string, string | null | undefined>;
}
```

*Size: **1412** lines of code.*

---

## 📄 `lib/supabase.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core business logic module. **We expect this to handle data processing, database interactions, or external integrations.**

### Core Code Logic & Implementations:

#### `function getCurrentUser`
```tsx
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      // 'Auth session missing!' is expected when not logged in — not a real error.
      if (error.message !== 'Auth session missing!') {
        console.warn('[SiteTrack] getCurrentUser warning:', error.message);
      }
      return null;
    }
    return user;
  } catch (err) {
    console.error('[SiteTrack] getCurrentUser unexpected error:', err);
    return null;
  }
}
```

#### `function signOut`
```tsx
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('[SiteTrack] signOut error:', error.message);
  }
}
```

*Size: **91** lines of code.*

---

## 📄 `lib/sync.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Core business logic module. **We expect this to handle data processing, database interactions, or external integrations.**

### Core Code Logic & Implementations:

#### `function onSyncComplete`
```tsx
export function onSyncComplete(listener: SyncCompleteListener): void {
  _syncListeners.add(listener);
}
```

#### `function offSyncComplete`
```tsx
export function offSyncComplete(listener: SyncCompleteListener): void {
  _syncListeners.delete(listener);
}
```

#### `function clearSyncListeners`
```tsx
export function clearSyncListeners(): void {
  _syncListeners.clear();
}
```

#### `function onSyncFailure`
```tsx
export function onSyncFailure(listener: SyncFailureListener): void {
  _failureListeners.add(listener);
}
```

#### `function offSyncFailure`
```tsx
export function offSyncFailure(listener: SyncFailureListener): void {
  _failureListeners.delete(listener);
}
```

#### `function clearSyncFailureListeners`
```tsx
export function clearSyncFailureListeners(): void {
  _failureListeners.clear();
}
```

#### `function startSync`
```tsx
export function startSync(userId?: string): void {
  // Always update the cached userId so a re-login with a different user works correctly
  if (userId) _cachedUserId = userId;

  if (_syncInterval) {
    // Already running — just trigger an immediate sync with the updated userId
    if (__DEV__) console.log('[SiteTrack Sync] Already running — triggering immediate sync');
    void runSync(userId);
    return;
  }
  if (__DEV__) console.log(`[SiteTrack Sync] Starting sync interval (${SYNC_INTERVAL_MS / 1000}s)`);
  // Run immediately on start, then repeat on interval
  void runSync(userId);
  _syncInterval = setInterval(() => {
    void runSync(_cachedUserId ?? undefined);
  }, SYNC_INTERVAL_MS);
}
```

#### `function stopSync`
```tsx
export function stopSync(): void {
  _shouldStop = true;
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
    if (__DEV__) console.log('[SiteTrack Sync] Sync stopped');
  }
  _cachedUserId = null;
  // H2: Purge all listeners on sign-out to prevent stale refs from previous session
  clearSyncListeners();
  clearSyncFailureListeners();
}
```

#### `function getCachedUserId`
```tsx
export function getCachedUserId(): string | null {
  return _cachedUserId;
}
```

#### `function getSyncStatus`
```tsx
export async function getSyncStatus(): Promise<SyncStatus> {
  const netState = await NetInfo.fetch();
  const lastSynced = await AsyncStorage.getItem(LAST_SYNCED_KEY);
  const pending = getPendingSyncItems();
  const failed  = getFailedSyncItems();
  return {
    lastSynced,
    pendingCount: pending.length,
    failedCount:  failed.length,
    isOnline: netState.isConnected === true && netState.isInternetReachable !== false,
  };
}
```

#### `function runSync`
```tsx
export async function runSync(userId?: string): Promise<boolean> {
  if (_isSyncing) {
    if (__DEV__) console.log('[SiteTrack Sync] Already in progress — skipping');
    return false;
  }

  // Reset abort flag at the start of each new run
  _shouldStop = false;

  // ── 1. Network check ─────────────────────────────────────────
  const netState = await NetInfo.fetch();
  const isOnline =
    netState.isConnected === true && netState.isInternetReachable !== false;

  if (!isOnline) {
    if (__DEV__) console.log('[SiteTrack Sync] Offline — skipping sync');
    return false;
  }

  _isSyncing = true;
  if (__DEV__) console.log('[SiteTrack Sync] Starting sync run...');

  try {
    let resolvedUserId = userId ?? _cachedUserId;
    if (!resolvedUserId) {
      const user = await getCurrentUser();
      if (_shouldStop) return false;
      if (!user) {
        if (__DEV__) console.log('[SiteTrack Sync] No authenticated user — skipping');
        return false;
      }
      resolvedUserId = user.id;
      _cachedUserId  = resolvedUserId;
    }

    if (_shouldStop) return false;
    if (__DEV__) console.log(`[SiteTrack Sync] Syncing for user: ${resolvedUserId}`);

    // --- REALTIME REVOCATION CHECK ---
    const { data: profile } = await supabase.from('users').select('is_active, company_id').eq('id', resolvedUserId).single();
    if (profile?.is_active === false) {
      console.warn('[SiteTrack Sync] Access revoked (User inactive). Forcing sign out.');
      useAuthStore.getState().forceFinalSyncAndSignOut();
      return false;
    }
    if (profile?.company_id) {
      const { data: company } = await supabase.from('companies').select('subscription_status').eq('id', profile.company_id).single();
      if (company?.subscription_status === 'suspended' || company?.subscription_status === 'cancelled') {
        console.warn('[SiteTrack Sync] Access revoked (Company suspended/cancelled). Forcing sign out.');
        useAuthStore.getState().forceFinalSyncAndSignOut();
        return false;
      }
    }
    // ---------------------------------

    // ── 2. PUSH — upload photo binaries then flush sync queue ────
    // BUG-N12 FIX: Guard processPhotoQueue with a boolean mutex so a manual
    // call from the report/preview screen can't overlap with the sync interval.
    if (!_isProcessingPhotos) {
      _isProcessingPhotos = true;
      try {
        await processPhotoQueue(resolvedUserId);
      } finally {
        _isProcessingPhotos = false;
      }
    } else {
      if (__DEV__) console.log('[SiteTrack Sync] Photo queue already processing — skipping duplicate run');
    }
    if (_shouldStop) return false;
    await _pushQueue();
    if (_shouldStop) return false;

    // ── 3. PULL — server → local SQLite ──────────────────────────
    const lastSynced = await AsyncStorage.getItem(LAST_SYNCED_KEY);
    if (_shouldStop) return false;
    await _pullJobs(resolvedUserId, lastSynced);
    if (_shouldStop) return false;

    // ── 4. Timestamp ──────────────────────────────────────────────
    const now = new Date().toISOString();
    await AsyncStorage.setItem(LAST_SYNCED_KEY, now);
    if (__DEV__) console.log(`[SiteTrack Sync] Sync complete at ${now}`);

    // ── 5. Warn about permanently-failed items and give stale ones a fresh retry
    // FIX: Items that have been permanently abandoned for >24h get their retry
    // budget reset. This prevents a transient network issue (RLS policy lag,
    // momentary offline) from permanently silencing a tech's field data.
    const { resetStaleFailedSyncItems } = await import('@/lib/database');
    const resetCount = resetStaleFailedSyncItems(24 * 60 * 60 * 1000);
    if (resetCount > 0 && __DEV__)
      console.log(`[SiteTrack Sync] Reset ${resetCount} stale permanently-failed item(s) for retry`);

    const failedItems = getFailedSyncItems();
    if (failedItems.length > 0) {
      // DECISION #3: never silently discard — always inform the user when data
      // cannot reach the server after exhausting all retries.
      _emitSyncFailureAlert({
        failedCount: failedItems.length,
        tables: [...new Set(failedItems.map(i => i.table_name))],
        lastError: failedItems[0]?.last_error ?? 'Unknown error',
      });
    }

    // ── 6. Clean up local photo files (15-day retention policy) ──────
    // Runs AFTER the photo upload queue so we only ever delete a local file
    // once photo_url has been confirmed as an https:// Supabase URL.
    // cleanupLocalPhotos() catches all its own errors \u2014 it can never crash sync.
    await cleanupLocalPhotos();

    // ── 7. Notify subscribers (stores reload from SQLite) ─────────────
    _emitSyncComplete();
    return true;
  } catch (err) {
    console.error('[SiteTrack Sync] Unexpected error during sync:', err);
    return false;
  } finally {
    _isSyncing = false;
  }
}
```

#### `type SyncFailureAlert`
```tsx
export interface SyncFailureAlert {
  /** Number of permanently-failed items */
  failedCount: number;
  /** Affected table names (de-duplicated) */
  tables: string[];
  /** Last error message from the most-recently failed item */
  lastError: string;
}
```

*Size: **673** lines of code.*

---

# 📁 `store/` Directory

## 📄 `store/authStore.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**

### Core Code Logic & Implementations:

#### `const useAuthStore`
```tsx
export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  company: null,
  session: null,
  isLoading: true,
  isForceSyncing: false,
  isAuthenticated: false,
  error: null,

  // Sign in
  signIn: async (email, password, rememberMe = false) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        console.error('[AuthStore] signIn error:', error.message, error);
        set({ error: error.message, isLoading: false });
        return;
      }

      if (!data.session || !data.user) {
        console.error('[AuthStore] signIn failed: No session or user returned.', data);
        set({ error: 'Sign in failed — no session returned.', isLoading: false });
        return;
      }

      // Fetch full profile from public.users
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        // No profile row — could be an admin account (no technician row).
        // Build a minimal fallback from the auth session so they can still log in.
        const fallback: User = {
          id: data.user.id,
          email: data.user.email ?? '',
          full_name:
            (data.user.user_metadata?.full_name as string) ??
            data.user.email?.split('@')[0] ??
            'User',
          role: UserRole.Admin,
          phone: null,
          avatar_url: null,
          is_active: true,
          created_at: data.user.created_at ?? new Date().toISOString(),
        };
        if (rememberMe) await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(fallback));
        set({ user: fallback, company: null, session: data.session, isAuthenticated: true, isLoading: false, error: null });
        return;
      }

      let fetchedCompany = null;
      // SaaS Subscription Lockout: check if the company is suspended
      if (profile.company_id) {
        const { data: companyRes } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .maybeSingle();
          
        if (companyRes) {
          fetchedCompany = companyRes;
          if (companyRes.subscription_status !== 'active') {
            await supabase.auth.signOut();
            set({ error: 'Your company account has been suspended. Please contact platform support.', isLoading: false });
            return;
          }
        }
      }

      // User Active Check: check if the technician was disabled by an admin
      if (profile.is_active === false) {
        await supabase.auth.signOut();
        set({ error: 'Your account has been deactivated. Please contact your company administrator.', isLoading: false });
        return;
      }

      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
      }
      // FLOW-11: Cache profile so offline restoreSession can succeed without network
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
      if (fetchedCompany) await AsyncStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(fetchedCompany));

      set({
        user: profile as User,
        company: fetchedCompany,
        session: data.session,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('[AuthStore] signIn unexpected exception:', err);
      set({
        error: 'An unexpected error occurred. Please try again.',
        isLoading: false,
      });
    }
  },

  // Sign out
  signOut: async () => {
    set({ isLoading: true });
    try {
      stopSync();
      await supabaseSignOut();
      // Security: clear ALL session data including cached profile.
      // Without USER_PROFILE_KEY removal, signing in as a different user
      // via biometrics would restore the previous user's profile.
      await AsyncStorage.multiRemove([REMEMBER_ME_KEY, SESSION_KEY, USER_PROFILE_KEY, COMPANY_CACHE_KEY]);
      clearDatabase();
    } catch (err) {
      console.error('[AuthStore] signOut error:', err);
    } finally {
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        isForceSyncing: false,
        error: null,
      });
    }
  },

  // Graceful exit for deactivated users — flushes offline data before wiping
  forceFinalSyncAndSignOut: async () => {
    // Prevent multiple parallel calls
    if (get().isForceSyncing) return;
    
    set({ isForceSyncing: true });
    try {
      let pending = getPendingSyncItems();
      if (pending.length > 0) {
        if (__DEV__) console.log(`[AuthStore] Deactivated user has ${pending.length} pending items. Attempting final sync...`);
        const { runSync } = await import('@/lib/sync');
        // Give it up to 5 strong attempts to push data
        for (let i = 0; i < 5; i++) {
          await runSync();
          pending = getPendingSyncItems();
          if (pending.length === 0) break;
          // backoff
          await new Promise(r => setTimeout(r, 3000));
        }
        
        // Critical Data Loss Prevention:
        // If we still have pending items (e.g. poor connection), DO NOT log out and wipe the DB.
        if (pending.length > 0) {
          console.warn(`[AuthStore] Final sync failed. ${pending.length} items remain. Aborting logout to prevent data loss.`);
          set({ isForceSyncing: false });
          import('react-native').then(rn => {
            rn.Alert.alert(
              'Final Sync Failed',
              'Your account was deactivated, but we could not upload your final offline work. Please connect to a strong Wi-Fi network so your work is not lost.',
              [{ text: 'OK' }]
            );
          });
          return; // Abort signOut()
        }
      }
      
      // If queue is empty (or was empty to begin with), safely wipe and logout
      await get().signOut();
    } catch (err) {
      console.error('[AuthStore] forceFinalSyncAndSignOut error:', err);
      set({ isForceSyncing: false });
    }
  },

  // Restore session on app launch
  // Uses 5-second timeouts so the app NEVER hangs on the splash screen
  // if Supabase is unreachable (offline, slow network, etc.)
  restoreSession: async () => {
    set({ isLoading: true });
    try {
      // C1 FIX: Check AsyncStorage cache first — instant auth for returning users / offline
      // This is especially important for biometric login where we call restoreSession
      // directly and can't afford a 5-second network timeout blocking the UX.
      const [cachedProfileStr, cachedCompanyStr, sessionResult] = await Promise.all([
        AsyncStorage.getItem(USER_PROFILE_KEY).catch(() => null),
        AsyncStorage.getItem(COMPANY_CACHE_KEY).catch(() => null),
        withTimeout(supabase.auth.getSession(), 5000),
      ]);

      // No valid session at all — send to login
      if (!sessionResult || sessionResult.error || !sessionResult.data.session) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const { session } = sessionResult.data;

      // If we have a cached profile, authenticate immediately — don't block on network
      if (cachedProfileStr) {
        try {
          const cached = JSON.parse(cachedProfileStr) as User;
          const cachedCompany = cachedCompanyStr ? JSON.parse(cachedCompanyStr) : null;
          set({ user: cached, company: cachedCompany, session, isAuthenticated: true, isLoading: false, error: null });
          // Refresh cache in the background (non-blocking) so it stays fresh
          // Also verify the company hasn't been suspended while the app was closed
          void Promise.resolve().then(async () => {
            const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
            if (profile) {
              await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile)).catch(() => null);
              
              if (profile.company_id) {
                const { data: companyRes } = await supabase
                  .from('companies')
                  .select('*')
                  .eq('id', profile.company_id)
                  .maybeSingle();
                
                if (companyRes) {
                  await AsyncStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(companyRes)).catch(() => null);
                  useAuthStore.setState({ company: companyRes });
                  if (companyRes.subscription_status !== 'active') {
                    console.warn('[AuthStore] Company suspended during background check. Forcing graceful logout.');
                    get().forceFinalSyncAndSignOut();
                  }
                } else if (profile.is_active === false) {
                  console.warn('[AuthStore] User deactivated during background check. Forcing graceful logout.');
                  get().forceFinalSyncAndSignOut();
                }
              } else if (profile.is_active === false) {
                console.warn('[AuthStore] User deactivated during background check. Forcing graceful logout.');
                get().forceFinalSyncAndSignOut();
              }
            }
          });
          return;
        } catch { /* corrupt cache — fall through to network fetch */ }
      }

      // No cache: fetch profile from Supabase (with safety timeout)
      type ProfileResult = { data: User | null; error: { message: string } | null };
      const profileResult = await withTimeout<ProfileResult>(
        (supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single() as unknown) as Promise<ProfileResult>,
        5000
      );

      if (!profileResult || profileResult.error || !profileResult.data) {
        // Profile fetch failed — build minimal fallback from session
        const su = session.user;
        const fallback: User = {
          id: su.id,
          email: su.email ?? '',
          full_name: (su.user_metadata?.full_name as string) ?? su.email?.split('@')[0] ?? 'User',
          role: UserRole.Admin,
          phone: null,
          avatar_url: null,
          is_active: true,
          created_at: su.created_at ?? new Date().toISOString(),
        };
        set({ user: fallback, company: null, session, isAuthenticated: true, isLoading: false });
        return;
      }

      // Save fresh profile to cache for future fast restores
      const profileData = profileResult.data as User;
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profileData));
      
      let fetchedCompany = null;
      // If we did a network fetch, check subscription status before allowing them in
      if (profileData.company_id) {
        const { data: companyRes } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profileData.company_id)
          .maybeSingle();
          
        if (companyRes) {
          fetchedCompany = companyRes;
          await AsyncStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(companyRes));
          
          if (companyRes.subscription_status !== 'active') {
            console.warn('[AuthStore] Company suspended during network restore. Forcing graceful logout.');
            get().forceFinalSyncAndSignOut();
            return;
          }
        }
      }

      if (profileData.is_active === false) {
        console.warn('[AuthStore] User deactivated during network restore. Forcing graceful logout.');
        get().forceFinalSyncAndSignOut();
        return;
      }

      set({
        user: profileData,
        company: fetchedCompany,
        session,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('[AuthStore] restoreSession error:', err);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  // Update user profile in local state
  updateUser: (updates) => {
    const current = get().user;
    if (current) {
      set({ user: { ...current, ...updates } });
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}
```

#### `type CompanyRecord`
```tsx
export interface CompanyRecord {
  id: string;
  name: string;
  subscription_status: string;
  [key: string]: unknown;
}
```

*Size: **404** lines of code.*

---

## 📄 `store/catalogueStore.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**

### Core Code Logic & Implementations:

#### `const useCatalogueStore`
```tsx
export const useCatalogueStore = create<CatalogueState>((set, get) => ({
  assetTypes: ASSET_TYPES,   // start with constants so UI is never blank
  defectCodes: DEFECT_CODES,
  _syncListenerRef: null,

  load: () => {
    try {
      const db = openDatabase();

      // ── Asset Types ──────────────────────────────────────
      const rows = db.getAllSync<{
        value: string; label: string; full_label: string;
        icon: string; color: string; inspection_routine: string; variants: string;
      }>('SELECT * FROM asset_type_definitions WHERE is_active = 1 ORDER BY sort_order ASC');

      if (rows.length > 0) {
        const typesMap = new Map<string, AssetTypeDefinition>();
        for (const r of rows) {
          typesMap.set(r.value, {
            value:             r.value,
            label:             r.label,
            fullLabel:         r.full_label,
            icon:              r.icon as IconName,
            color:             r.color,
            inspectionRoutine: r.inspection_routine,
            variants:          (() => { try { return JSON.parse(r.variants); } catch { return []; } })(),
          });
        }
        set({ assetTypes: Array.from(typesMap.values()) });
      }

      // ── Defect Codes ─────────────────────────────────────
      const codes = db.getAllSync<{
        code: string; description: string; quote_price: number | null; category: string;
      }>('SELECT * FROM defect_codes WHERE is_active = 1 ORDER BY sort_order ASC');

      if (codes.length > 0) {
        const codesMap = new Map<string, DefectCode>();
        for (const c of codes) {
          codesMap.set(c.code, {
            code:        c.code,
            description: c.description,
            quote_price: c.quote_price ?? undefined,
            category:    c.category as DefectCategory,
          });
        }
        set({ defectCodes: Array.from(codesMap.values()) });
      }
    } catch (e) {
      console.warn('[CatalogueStore] load error:', e);
    }
  },

  subscribeToSync: () => {
    // Deregister any stale listener before creating a new one
    const prev = get()._syncListenerRef;
    if (prev) offSyncComplete(prev);

    const listener = () => {
      if (__DEV__) console.log('[CatalogueStore] sync complete — refreshing catalogue');
      useCatalogueStore.getState().load();
    };
    onSyncComplete(listener);
    set({ _syncListenerRef: listener });
  },

  unsubscribeFromSync: () => {
    const listener = get()._syncListenerRef;
    if (listener) {
      offSyncComplete(listener);
      set({ _syncListenerRef: null });
    }
  },
}
```

*Size: **101** lines of code.*

---

## 📄 `store/dashboardStore.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**

### Core Code Logic & Implementations:

#### `const useDashboardStore`
```tsx
export const useDashboardStore = create<DashboardState & DashboardActions>((set, get) => ({
  todayJobs: [],
  todayStats: { total: 0, completed: 0, inProgress: 0, pending: 0 },
  allStats:   { total: 0, completed: 0, inProgress: 0, pending: 0 },
  weekStats: { total: 0, completed: 0 },
  openDefectsCount: 0,
  isLoading: false,
  error: null,
  _syncListenerRef: null,

  loadDashboard: (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = openDatabase();
      const todayStr = today();

      // ── Today's jobs (with property info) ──────────────────
      const todayJobRows = db.getAllSync<Job>(
        `SELECT j.*, p.name AS property_name, p.address AS property_address,
                p.suburb AS property_suburb, p.state AS property_state
         FROM jobs j
         LEFT JOIN properties p ON j.property_id = p.id
         WHERE j.assigned_to = ?
           AND j.scheduled_date = ?
           AND j.status != ?
         ORDER BY j.scheduled_time ASC, j.priority DESC`,
        [userId, todayStr, JobStatus.Cancelled]
      );

      // ── Today stats ──────────────────────────────────────────
      const total = todayJobRows.length;
      const completed = todayJobRows.filter((j) => j.status === JobStatus.Completed).length;
      const inProgress = todayJobRows.filter((j) => j.status === JobStatus.InProgress).length;
      const pending = todayJobRows.filter((j) => j.status === JobStatus.Scheduled).length;

      // ── This week stats ──────────────────────────────────────
      const { start, end } = weekRange();
      const weekRows = db.getAllSync<{ status: string }>(
        `SELECT status FROM jobs
         WHERE assigned_to = ?
           AND scheduled_date BETWEEN ? AND ?
           AND status != ?`,
        [userId, start, end, JobStatus.Cancelled]
      );
      const weekTotal = weekRows.length;
      const weekCompleted = weekRows.filter((r) => r.status === JobStatus.Completed).length;

      // ── Open defects — real count from SQLite ─────────────────
      const defectRow = db.getFirstSync<{ count: number }>(
        `SELECT COUNT(*) as count FROM defects
         WHERE status = 'open'
           AND job_id IN (
             SELECT id FROM jobs WHERE assigned_to = ?
           )`,
        [userId]
      );
      const openDefectsCount = defectRow?.count ?? 0;

      // ── All-time stats — single aggregate query (no row materialisation) ───────
      const allStatsRow = db.getFirstSync<{
        total: number; completed: number; in_progress_count: number; pending: number;
      }>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS in_progress_count,
           SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS pending
         FROM jobs WHERE assigned_to = ? AND status != ?`,
        [JobStatus.Completed, JobStatus.InProgress, JobStatus.Scheduled, userId, JobStatus.Cancelled]
      );
      const allTotal      = allStatsRow?.total ?? 0;
      const allCompleted  = allStatsRow?.completed ?? 0;
      const allInProgress = allStatsRow?.in_progress_count ?? 0;
      const allPending    = allStatsRow?.pending ?? 0;

      set({
        todayJobs: todayJobRows,
        todayStats: { total, completed, inProgress, pending },
        allStats: { total: allTotal, completed: allCompleted, inProgress: allInProgress, pending: allPending },
        weekStats: { total: weekTotal, completed: weekCompleted },
        openDefectsCount,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('[DashboardStore] loadDashboard error:', err);
      set({
        isLoading: false,
        error: 'Failed to load dashboard. Tap to retry.',
      });
    }
  },

  clearError: () => set({ error: null }),

  subscribeToSync: (userId: string) => {
    // Clean up any previously registered listener before subscribing again
    const prev = get()._syncListenerRef;
    if (prev) offSyncComplete(prev);

    const listener = () => {
      if (__DEV__) console.log('[DashboardStore] sync complete — reloading dashboard');
      useDashboardStore.getState().loadDashboard(userId);
    };
    onSyncComplete(listener);
    set({ _syncListenerRef: listener });
  },

  unsubscribeFromSync: () => {
    const listener = get()._syncListenerRef;
    if (listener) {
      offSyncComplete(listener);
      set({ _syncListenerRef: null });
    }
  },
}
```

*Size: **173** lines of code.*

---

## 📄 `store/defectsStore.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**

### Core Code Logic & Implementations:

#### `const useDefectsStore`
```tsx
export const useDefectsStore = create<DefectsState>((set, get) => ({
  defects: [],
  isLoading: false,
  isSaving: false,
  error: null,

  loadDefects: (jobId) => {
    try {
      // BUG 26 FIX: clear previous job's defects before fetch so stale data doesn't flash
      set({ isLoading: true, error: null, defects: [] });
      const records = getDefectsForJob<Defect>(jobId);
      set({ defects: normaliseDefects(records), isLoading: false });
    } catch (err: unknown) {
      console.error('[DefectsStore] loadDefects error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  loadAllDefects: (statusFilter) => {
    try {
      set({ isLoading: true, error: null, defects: [] });
      const records = getAllDefects<Defect>(statusFilter);
      set({ defects: normaliseDefects(records), isLoading: false });
    } catch (err: unknown) {
      console.error('[DefectsStore] loadAllDefects error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  addDefect: (defectData) => {
    try {
      set({ isSaving: true, error: null });
      const id = generateUUID();
      
      const { photos, ...defectWithoutPhotos } = defectData;

      // FIX: inject company_id so the sync-queue INSERT satisfies Supabase RLS.
      const companyId = useAuthStore.getState().user?.company_id ?? null;

      const payload: Defect = {
        ...defectWithoutPhotos,
        photos: photos || [], // keep for memory
        id,
        status: DefectStatus.Open,
        created_at: new Date().toISOString(),
      };

      const dbPayload = {
        ...payload,
        company_id: companyId,
        photos: JSON.stringify(photos || []), // save actual photos to SQLite
        defect_code: payload.defect_code ?? null,
        quote_price: payload.quote_price ?? null,
      };

      insertRecord('defects', dbPayload as Record<string, string | number | boolean | null>);
      addToSyncQueue('defects', id, SyncOperation.Insert, dbPayload as Record<string, string | number | boolean | null>);

      const userId = useAuthStore.getState().user?.id ?? '';

      // Insert photos into inspection_photos and queue them
      if (photos && photos.length > 0) {
        for (const uri of photos) {
          const photoId = generateUUID();
          const photoObj = {
            id: photoId,
            job_id: payload.job_id,
            asset_id: payload.asset_id === 'unlinked' ? null : payload.asset_id,
            defect_id: id,
            photo_url: uri,
            local_uri: uri.startsWith('file://') || uri.startsWith('content://') ? uri : null,
            caption: null,
            uploaded_at: new Date().toISOString(),
            uploaded_by: userId,
          };
          insertRecord('inspection_photos', photoObj as unknown as Record<string, string | number | boolean | null>);
          queuePhotoUpload(uri, payload.job_id, photoObj.asset_id ?? undefined, photoId, id);
        }
      }

      set((state) => ({
        defects: [payload, ...state.defects],
        isSaving: false,
      }));

      return id;
    } catch (err: unknown) {
      console.error('[DefectsStore] addDefect error:', err);
      set({ error: errorMessage(err), isSaving: false });
      return null;
    }
  },

  updateDefect: (defectId, updates) => {
    try {
      set({ isSaving: true, error: null });

      // If photos array is updated, serialise before writing to SQLite
      // BUG-N10 FIX: inject company_id so UPDATE payload passes Supabase RLS on cold-start.
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const dbUpdates: Record<string, string | number | boolean | null> = {
        ...(updates as Record<string, string | number | boolean | null>),
        ...(updates.photos !== undefined
          ? { photos: JSON.stringify(updates.photos) }
          : {}),
        company_id: companyId,
      };

      updateRecord('defects', defectId, dbUpdates);
      addToSyncQueue('defects', defectId, SyncOperation.Update, dbUpdates);

      set((state) => ({
        defects: state.defects.map((d) =>
          d.id === defectId ? { ...d, ...updates } : d
        ),
        isSaving: false,
      }));
    } catch (err: unknown) {
      console.error('[DefectsStore] updateDefect error:', err);
      set({ error: errorMessage(err), isSaving: false });
    }
  },

  updateDefectStatus: (defectId, status) => {
    try {
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const dbUpdates = { status, updated_at: new Date().toISOString(), company_id: companyId };
      updateRecord('defects', defectId, dbUpdates);
      addToSyncQueue('defects', defectId, SyncOperation.Update, dbUpdates);

      set((state) => ({
        defects: state.defects.map((d) =>
          d.id === defectId ? { ...d, status } : d
        ),
      }));
    } catch (err: unknown) {
      console.error('[DefectsStore] updateDefectStatus error:', err);
      set({ error: errorMessage(err) });
    }
  },

  deleteDefect: (defectId) => {
    try {
      set({ isSaving: true, error: null });

      // A4 FIX: Cancel / delete all inspection_photos associated with this defect
      // BEFORE deleting the defect row, so we don't leave orphaned upload tasks.
      const defectPhotos = queryRecords<{ id: string; photo_url: string }>(
        'inspection_photos', { defect_id: defectId }
      );
      for (const p of defectPhotos) {
        deleteRecord('inspection_photos', p.id);
        recordDeletedPhoto(p.id);
        if (p.photo_url.startsWith('https://')) {
          addToSyncQueue('inspection_photos', p.id, SyncOperation.Delete, {
            id: p.id,
            photo_url: p.photo_url,
          });
        } else {
          cancelPendingPhotoUpload(p.id);
        }
      }

      deleteRecord('defects', defectId);
      addToSyncQueue('defects', defectId, SyncOperation.Delete, { id: defectId });

      set((state) => ({
        defects: state.defects.filter((d) => d.id !== defectId),
        isSaving: false,
      }));
    } catch (err: unknown) {
      console.error('[DefectsStore] deleteDefect error:', err);
      set({ error: errorMessage(err), isSaving: false });
    }
  },

  clearError: () => set({ error: null }),
}
```

*Size: **230** lines of code.*

---

## 📄 `store/inspectionStore.ts`

> **Description:** store/inspectionStore.ts Fix summary (this revision): 1. updateAssetResult: photos[] now written to the in-memory asset after a FAIL result. Previously photos were inserted into inspection_photos + queued for upload, but the in-memory AssetWithResult.photos array was never updated. This caused getReferencedPhotoIds in pdfGenerator to correctly include the asset, but loadAssetsForInspection had to be called again to see the photos — meaning a PDF generated in the same session as the inspection would always have blank photo slots for fail assets. 2. updateAssetResult: when updating an existing defect, photos are now also re-queued so a re-inspection with new photos doesn't silently drop them. 3. addPhotoToAsset: passes defect_id: null explicitly to queuePhotoUpload via photosStore (no change to behaviour, just made explicit for clarity). 4. Minor: consistent null coalescing, removed a stray indent on newAssets declaration.
>
> **What we expect from it:** Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**

### Core Code Logic & Implementations:

#### `const useInspectionStore`
```tsx
export const useInspectionStore = create<InspectionState>((set, get) => ({
  assets: [],
  currentJobId: null,
  isLoading: false,
  isSaving: false,
  error: null,
  progress: { inspected: 0, total: 0 },

  loadAssetsForInspection: (jobId) => {
    try {
      set({ isLoading: true, error: null, currentJobId: jobId });

      const job = getJobById<{ property_id: string }>(jobId);
      if (!job) throw new Error('Job not found');

      const dbAssets         = getAssetsForProperty<Asset>(job.property_id);
      const jobAssets        = queryRecords<JobAsset>('job_assets', { job_id: jobId })
        .sort((a, b) => (b.actioned_at ?? '').localeCompare(a.actioned_at ?? ''));
      const inspectionPhotos = queryRecords<{ asset_id: string; photo_url: string }>(
        'inspection_photos', { job_id: jobId }
      );

      // Load previous results only for assets in this property (avoids full table scan)
      const assetIds = dbAssets.map(a => a.id);
      const allPreviousJobAssets = queryRecordsIn<{
        asset_id: string; result: string; actioned_at: string; job_id: string;
      }>('job_assets', 'asset_id', assetIds);

      const merged: AssetWithResult[] = dbAssets.map(asset => {
        const ja = jobAssets.find(j => j.asset_id === asset.id);
        const photosForAsset = inspectionPhotos
          .filter(p => p.asset_id === asset.id)
          .map(p => p.photo_url);

        const prevRecords = allPreviousJobAssets
          .filter(r => r.asset_id === asset.id && r.job_id !== jobId && r.result != null)
          .sort((a, b) => (b.actioned_at ?? '').localeCompare(a.actioned_at ?? ''));
        const prev = prevRecords[0] ?? null;

        return {
          ...asset,
          result: ja?.result ?? null,
          checklist_data: ja?.checklist_data ?? null,
          is_compliant: Boolean(ja?.is_compliant),
          defect_reason: ja?.defect_reason ?? null,
          technician_notes: ja?.technician_notes ?? null,
          job_asset_id: ja?.id ?? null,
          photos: photosForAsset,
          previousResult: prev ? (prev.result as InspectionResult) : null,
          previousDate: prev?.actioned_at ? prev.actioned_at.slice(0, 10) : null,
        };
      });

      set({ assets: merged, progress: calcProgress(merged), isLoading: false });
    } catch (err: unknown) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  updateAssetResult: (
    assetId, result, checklistData, isCompliant,
    defectReason, notes, photos, severity, defectCode, quotePrice,
  ) => {
    try {
      set({ isSaving: true, error: null });
      const { assets, currentJobId } = get();
      if (!currentJobId) throw new Error('No active job');

      const assetIndex = assets.findIndex(a => a.id === assetId);
      if (assetIndex === -1) throw new Error('Asset not found');
      const asset = assets[assetIndex];

      // Resolve the job_asset id — prefer the in-memory one (fastest path), then fall
      // back to a DB lookup.  This prevents duplicate rows when the modal is saved
      // before the in-memory state has been refreshed with the newly-assigned id.
      // A9 FIX: Merged two separate queryRecords calls into one.
      let jobAssetId = asset.job_asset_id;
      let isExistingRecord = Boolean(asset.job_asset_id);
      if (!jobAssetId) {
        const existing = queryRecords<{ id: string }>(
          'job_assets', { job_id: currentJobId, asset_id: assetId }
        )[0];
        jobAssetId = existing?.id ?? generateUUID();
        isExistingRecord = Boolean(existing);
      }

      // FIX: inject company_id for RLS on job_assets INSERT/UPDATE.
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const userId = useAuthStore.getState().user?.id ?? '';

      const jobAssetPayload: Record<string, string | number | null> = {
        id: jobAssetId,
        job_id: currentJobId,
        asset_id: assetId,
        company_id: companyId,
        result: result ?? null,
        checklist_data: checklistData ?? null,
        is_compliant: isCompliant ? 1 : 0,
        defect_reason: defectReason ?? null,
        technician_notes: notes ?? null,
        actioned_at: new Date().toISOString(),
      };

      upsertRecord('job_assets', jobAssetPayload);

      // Purge any duplicate rows for this asset+job that have a different id.
      // These can accumulate from rapid taps before the first save completes.
      try {
        const db = openDatabase();
        db.runSync(
          `DELETE FROM job_assets WHERE job_id = ? AND asset_id = ? AND id != ?`,
          [currentJobId, assetId, jobAssetId],
        );
      } catch { /* non-fatal */ }

      const syncOp = isExistingRecord ? SyncOperation.Update : SyncOperation.Insert;
      addToSyncQueue('job_assets', jobAssetId, syncOp, jobAssetPayload);


      // ── Photo reconciliation ────────────────────────────────────────────────
      // `photos` is the FINAL desired set of URIs the user left in the modal.
      // We diff it against what is currently in SQLite:
      //   • Deleted photos  → remove from SQLite immediately.
      //                       If the photo was already uploaded (https://) → also
      //                       queue a Supabase DB row delete + Storage binary delete.
      //                       If still local (file://) → cancel the pending
      //                       photo_upload task so it never reaches Supabase.
      //   • Kept photos     → leave as-is (preserve upload state).
      //   • New photos      → insert into SQLite and queue for upload.
      let savedPhotoUris: string[] = []; // newly-inserted URIs (for defect back-fill)

      if (photos !== undefined) {
        const existingRows = queryRecords<{ id: string; photo_url: string }>(
          'inspection_photos',
          { job_id: currentJobId, asset_id: assetId },
        );

        const desiredUrlSet  = new Set(photos);
        const existingUrlSet = new Set(existingRows.map(r => r.photo_url));

        // ── Deletions ────────────────────────────────────────────────────────
        for (const row of existingRows) {
          if (!desiredUrlSet.has(row.photo_url)) {
            // 1. Remove from local SQLite immediately
            deleteRecord('inspection_photos', row.id);

            // 2. Permanently record in tombstone — survives retries/reinstalls
            recordDeletedPhoto(row.id);

            if (row.photo_url.startsWith('https://')) {
              // Photo is already in Supabase — queue a delete for both the DB row
              // and the Storage binary (sync.ts _pushQueue handles both).
              addToSyncQueue('inspection_photos', row.id, SyncOperation.Delete, {
                id: row.id,
                photo_url: row.photo_url,
              });
            } else {
              // Photo only exists locally (file:// URI, not yet uploaded).
              // Cancel the pending photo_upload task so it is never sent to Supabase.
              // No Supabase row exists yet, so no DB delete is needed.
              cancelPendingPhotoUpload(row.id);
            }
          }
        }

        // ── Insertions ────────────────────────────────────────────────────────
        const newPhotoUris = photos.filter(uri => !existingUrlSet.has(uri));
        savedPhotoUris = newPhotoUris;

        for (const uri of newPhotoUris) {
          const photoId = generateUUID();
          const photoObj = {
            id: photoId,
            job_id: currentJobId,
            asset_id: assetId,
            defect_id: null as string | null,
            photo_url: uri,
            // FIX: Store the original file:// URI so offline PDF generation can
            // fall back to the local copy after photo_url is replaced with https://.
            local_uri: uri.startsWith('file://') || uri.startsWith('content://') ? uri : null,
            caption: null,
            uploaded_at: new Date().toISOString(),
            uploaded_by: userId,
          };
          insertRecord('inspection_photos', photoObj as Record<string, string | number | boolean | null>);
          queuePhotoUpload(uri, currentJobId, assetId, photoId, undefined);
        }
      }

      // ── Auto-delete defect when asset passes / not-tested ─
      // If the previous result was Fail and the new result is Pass or NotTested,
      // the defect is no longer valid — remove it automatically.
      // A3 FIX: Also cancel/delete the defect's associated inspection_photos so
      // they don't get uploaded as orphaned rows in Supabase.
      if (result !== InspectionResult.Fail) {
        const staleDefects = queryRecords<{ id: string }>('defects', {
          job_id: currentJobId,
          asset_id: assetId,
        });
        for (const stale of staleDefects) {
          // Cancel associated photos first
          const stalePhotos = queryRecords<{ id: string; photo_url: string }>(
            'inspection_photos', { defect_id: stale.id }
          );
          for (const p of stalePhotos) {
            deleteRecord('inspection_photos', p.id);
            recordDeletedPhoto(p.id);
            if (p.photo_url.startsWith('https://')) {
              addToSyncQueue('inspection_photos', p.id, SyncOperation.Delete, {
                id: p.id, photo_url: p.photo_url,
              });
            } else {
              cancelPendingPhotoUpload(p.id);
            }
          }
          deleteRecord('defects', stale.id);
          addToSyncQueue('defects', stale.id, SyncOperation.Delete, { id: stale.id });
        }
        if (staleDefects.length > 0) {
          // Refresh defects store so the badge and list update immediately
          useDefectsStore.getState().loadDefects(currentJobId);
        }
      }

      // ── Defect auto-create / update ───────────────────────
      if (result === InspectionResult.Fail && defectReason) {
        const existingDefects = queryRecords<{ id: string }>('defects', {
          job_id: currentJobId,
          asset_id: assetId,
        });

        if (existingDefects.length === 0) {
          const defectId = generateUUID();
          const resolvedSeverity = severity ?? DefectSeverity.Major;
          const resolvedPhotos = savedPhotoUris.length > 0
            ? JSON.stringify(savedPhotoUris)
            : '[]';

          const defectPayload: Record<string, string | number | null> = {
            id: defectId,
            job_id: currentJobId,
            asset_id: assetId,
            property_id: asset.property_id,
            company_id: companyId,
            description: defectReason,
            severity: resolvedSeverity,
            status: DefectStatus.Open,
            photos: resolvedPhotos,
            created_at: new Date().toISOString(),
            defect_code: defectCode ?? null,
            quote_price: quotePrice ?? null,
          };
          insertRecord('defects', defectPayload);
          addToSyncQueue('defects', defectId, SyncOperation.Insert, defectPayload);

          // Back-fill defect_id on the inspection_photos rows we just inserted
          // so pdfGenerator can correctly link them to the defect box in the report.
          if (savedPhotoUris.length > 0) {
            const recentPhotos = queryRecords<{ id: string; photo_url: string }>(
              'inspection_photos',
              { job_id: currentJobId, asset_id: assetId },
            );
            for (const p of recentPhotos) {
              if (savedPhotoUris.includes(p.photo_url)) {
                updateRecord('inspection_photos', p.id, { defect_id: defectId });
              }
            }
          }

          // Refresh defects store so the badge updates immediately
          useDefectsStore.getState().loadDefects(currentJobId);
        } else {
          // Update existing defect description/severity and reconcile photos
          const existingId = existingDefects[0].id;
          const updates: Record<string, string | number | null> = {
            description: defectReason,
            severity: severity ?? DefectSeverity.Major,
          };

          // Replace defect.photos with the COMPLETE current desired set.
          // Using the full desired photos array (not just new ones) ensures that:
          //   • Photos deleted by the user are removed from the defect record.
          //   • New photos are added to the defect record.
          //   • Previously saved photos that the user kept are preserved.
          if (photos !== undefined) {
            updates.photos = JSON.stringify(photos);
          }

          // Back-fill defect_id on newly inserted inspection_photos rows
          if (savedPhotoUris.length > 0) {
            const recentPhotos = queryRecords<{ id: string; photo_url: string }>(
              'inspection_photos',
              { job_id: currentJobId, asset_id: assetId },
            );
            for (const p of recentPhotos) {
              if (savedPhotoUris.includes(p.photo_url)) {
                updateRecord('inspection_photos', p.id, { defect_id: existingId });
              }
            }
          }

          updateRecord('defects', existingId, updates);
          addToSyncQueue('defects', existingId, SyncOperation.Update, updates);
        }
      }

      // ── Update in-memory state ─────────────────────────────
      // Set in-memory photos to exactly what is currently in SQLite after reconciliation.
      // This is critical: using an additive merge (old + new) means deleted photos
      // remain in memory and get passed back into the modal the next time it opens,
      // causing them to be re-saved as if the user kept them.
      const finalPhotoUris = photos !== undefined
        ? photos  // the modal's desired set IS the final set
        : asset.photos;

      const newAssets = [...assets];
      newAssets[assetIndex] = {
        ...asset,
        result,
        checklist_data: checklistData ?? null,
        is_compliant: isCompliant ?? false,
        defect_reason: defectReason ?? null,
        technician_notes: notes ?? null,
        job_asset_id: jobAssetId,
        photos: finalPhotoUris,
      };

      set({
        assets: newAssets,
        progress: calcProgress(newAssets),
        isSaving: false,
      });
    } catch (err: unknown) {
      set({ error: errorMessage(err), isSaving: false });
    }
  },

  addPhotoToAsset: (assetId, photoUri) => {
    const { assets, currentJobId } = get();
    if (!currentJobId) return;

    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      console.warn('[InspectionStore] addPhotoToAsset: no authenticated user — skipping');
      return;
    }

    usePhotosStore.getState().addPhoto({
      job_id: currentJobId,
      asset_id: assetId,
      defect_id: null,
      photo_url: photoUri,
      local_uri: (photoUri.startsWith('file://') || photoUri.startsWith('content://')) ? photoUri : null,
      caption: null,
      uploaded_by: userId,
    });

    const newAssets = assets.map(a =>
      a.id === assetId ? { ...a, photos: [...a.photos, photoUri] } : a
    );
    set({ assets: newAssets });
  },

  isInspectionComplete: () => {
    const { assets } = get();
    const hasActualResult = assets.some(
      a => a.result === InspectionResult.Pass || a.result === InspectionResult.Fail
    );
    const allAnswered = assets.length > 0 && assets.every(a => a.result !== null);
    return allAnswered && hasActualResult;
  },

  reset: () => {
    // Full reset — clears all fields to prevent stale data from a previous
    // inspection job from flashing when the user navigates to a new job.
    set({
      assets:       [],
      currentJobId: null,
      isLoading:    false,
      isSaving:     false,
      error:        null,
      progress:     { inspected: 0, total: 0 },
    });
  },
}
```

#### `type AssetWithResult`
```tsx
export type AssetWithResult = Asset & {
  result: InspectionResult | null;
  checklist_data: string | null;
  is_compliant: boolean;
  defect_reason: string | null;
  technician_notes: string | null;
  job_asset_id: string | null;
  photos: string[];
  previousResult: InspectionResult | null;
  previousDate: string | null;
}
```

*Size: **485** lines of code.*

---

## 📄 `store/inventoryStore.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**

### Core Code Logic & Implementations:

#### `const useInventoryStore`
```tsx
export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  loadInventory: () => {
    set({ isLoading: true, error: null });
    try {
      const dbItems = queryRecords<InventoryItem>('inventory_items');
      set({
        items: [...dbItems].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      });
    } catch (err: unknown) {
      console.error('[InventoryStore] loadInventory error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}
```

*Size: **43** lines of code.*

---

## 📄 `store/jobsStore.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**

### Core Code Logic & Implementations:

#### `const useJobsStore`
```tsx
export const useJobsStore = create<JobsState & JobsActions>((set, get) => ({
  jobs: [],
  selectedJob: null,
  isLoading: false,
  error: null,
  activeFilter: 'all',
  searchQuery: '',
  _syncListenerRef: null,

  loadJobs: (userId) => {
    set({ isLoading: true, error: null });
    try {
      const jobs = getJobsForTechnician<JobWithProperty>(userId);
      set({ jobs, isLoading: false });
    } catch (err) {
      console.error('[JobsStore] loadJobs error:', err);
      set({ error: 'Failed to load jobs. Pull down to retry.', isLoading: false });
    }
  },

  subscribeToSync: (userId) => {
    // Clean up any previously registered listener before subscribing again
    const prev = get()._syncListenerRef;
    if (prev) offSyncComplete(prev);

    const listener = () => {
      if (__DEV__) console.log('[JobsStore] sync complete — reloading jobs');
      useJobsStore.getState().loadJobs(userId);
    };
    onSyncComplete(listener);
    set({ _syncListenerRef: listener });
  },

  unsubscribeFromSync: () => {
    const listener = get()._syncListenerRef;
    if (listener) {
      offSyncComplete(listener);
      set({ _syncListenerRef: null });
    }
  },

  getFilteredJobs: () => {
    const { jobs, activeFilter, searchQuery } = get();
    const today = todayISO();
    const { start, end } = weekRange();

    let filtered = jobs;

    // Date filter
    if (activeFilter === 'today') {
      filtered = jobs.filter((j) => j.scheduled_date === today);
    } else if (activeFilter === 'week') {
      filtered = jobs.filter(
        (j) => j.scheduled_date >= start && j.scheduled_date <= end
      );
    }

    // Search filter — all relevant fields
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(
        (j) =>
          (j.property_name ?? '').toLowerCase().includes(q) ||
          (j.property_address ?? '').toLowerCase().includes(q) ||
          (j.property_suburb ?? '').toLowerCase().includes(q) ||
          (j.property_state ?? '').toLowerCase().includes(q) ||
          (j.job_type ?? '').toLowerCase().includes(q) ||
          (j.notes ?? '').toLowerCase().includes(q)
      );
    }

    return filtered;
  },

  selectJob: (jobId) => {
    const job = get().jobs.find((j) => j.id === jobId) ?? null;
    set({ selectedJob: job });
  },

  clearSelectedJob: () => set({ selectedJob: null }),

  setFilter: (filter) => set({ activeFilter: filter }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  updateJobStatus: (jobId, newStatus) => {
    try {
      const now = new Date().toISOString();
      // Include company_id so the UPDATE sync payload passes Supabase RLS.
      // Read from local SQLite users table (never trust the in-memory store alone
      // since the store could be mid-rehydration on cold start).
      const userId = useAuthStore.getState().user?.id ?? null;
      const localUser = userId ? getRecord<{ company_id: string | null }>('users', userId) : null;
      const companyId = localUser?.company_id ?? useAuthStore.getState().user?.company_id ?? null;

      const update = { status: newStatus, updated_at: now, company_id: companyId };
      updateRecord('jobs', jobId, update);
      addToSyncQueue('jobs', jobId, SyncOperation.Update, update);

      // Optimistic UI update — reflects change before the next sync cycle
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId ? { ...j, status: newStatus, updated_at: now } : j
        ),
        selectedJob:
          state.selectedJob?.id === jobId
            ? { ...state.selectedJob, status: newStatus, updated_at: now }
            : state.selectedJob,
      }));
    } catch (err) {
      console.error('[JobsStore] updateJobStatus error:', err);
    }
  },

  clearError: () => set({ error: null }),
}
```

#### `type JobWithProperty`
```tsx
export type JobWithProperty = Job & {
  property_name: string | null;
  property_address: string | null;
  property_suburb: string | null;
  property_state: string | null;
  property_postcode: string | null;
  property_compliance_status: string | null;
  access_notes: string | null;
  hazard_notes: string | null;
  site_note: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
}
```

#### `type JobFilter`
```tsx
export type JobFilter = 'today' | 'week' | 'all';

// ─── Date helpers ─────────────────────────────────────────────
function todayISO(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
```

*Size: **187** lines of code.*

---

## 📄 `store/notificationsStore.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**

### Core Code Logic & Implementations:

#### `const useNotificationsStore`
```tsx
export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  totalCount: 0,
  isLoading: false,
  error: null,

  loadNotifications: () => {
    try {
      set({ isLoading: true, error: null });
      const db = openDatabase();
      // Get total count first so we can tell the user if they're seeing a capped view
      const countRow = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) AS count FROM notifications`);
      const totalCount = countRow?.count ?? 0;

      const rows = db.getAllSync<Record<string, unknown>>(
        `SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`,
        [MAX_NOTIFICATIONS],
      );
      const notifications = rows.map(mapRow);
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.is_read).length,
        totalCount,
        isLoading: false,
      });
    } catch (err: unknown) {
      console.error('[NotificationsStore] loadNotifications error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  markAsRead: (id) => {
    try {
      const db = openDatabase();
      db.runSync(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
      set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        );
        return { notifications, unreadCount: notifications.filter((n) => !n.is_read).length };
      });
    } catch (err: unknown) {
      console.error('[NotificationsStore] markAsRead error:', err);
      set({ error: errorMessage(err) });
    }
  },

  markAllAsRead: () => {
    try {
      const db = openDatabase();
      db.runSync(`UPDATE notifications SET is_read = 1`);
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch (err: unknown) {
      console.error('[NotificationsStore] markAllAsRead error:', err);
      set({ error: errorMessage(err) });
    }
  },

  addNotification: (data) => {
    try {
      const id = generateUUID();
      const now = new Date().toISOString();
      const db = openDatabase();
      db.runSync(
        `INSERT INTO notifications (id, type, title, message, job_id, user_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [id, data.type, data.title, data.message, data.job_id ?? null, data.user_id ?? null, now],
      );
      const newNotif: AppNotification = {
        id,
        type:       data.type,
        title:      data.title,
        message:    data.message,
        job_id:     data.job_id ?? null,
        user_id:    data.user_id ?? null,
        is_read:    false,
        created_at: now,
      };
      set((state) => ({
        notifications: [newNotif, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }));
    } catch (err: unknown) {
      console.error('[NotificationsStore] addNotification error:', err);
      set({ error: errorMessage(err) });
    }
  },

  clearAll: () => {
    try {
      const db = openDatabase();
      db.runSync(`DELETE FROM notifications`);
      set({ notifications: [], unreadCount: 0, totalCount: 0, error: null });
    } catch (err: unknown) {
      console.error('[NotificationsStore] clearAll error:', err);
      set({ error: errorMessage(err) });
    }
  },

  clearError: () => set({ error: null }),
}
```

#### `type NotificationType`
```tsx
export type NotificationType =
  | 'new_job'
  | 'urgent_job'
  | 'sync_complete'
  | 'defect_flagged'
  | 'general';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  job_id: string | null;
  user_id: string | null; // which technician this notification is for (null = broadcast)
  is_read: boolean;       // SQLite stores as 0/1; we convert to bool
  created_at: string;     // ISO 8601
}
```

#### `type AppNotification`
```tsx
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  job_id: string | null;
  user_id: string | null; // which technician this notification is for (null = broadcast)
  is_read: boolean;       // SQLite stores as 0/1; we convert to bool
  created_at: string;     // ISO 8601
}
```

*Size: **168** lines of code.*

---

## 📄 `store/photosStore.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**

### Core Code Logic & Implementations:

#### `const usePhotosStore`
```tsx
export const usePhotosStore = create<PhotosState>((set, get) => ({
  photos: [],
  isLoading: false,
  error: null,

  loadPhotos: (jobId) => {
    try {
      // Clear previous job's photos immediately to prevent stale flash
      set({ photos: [], isLoading: true, error: null });
      const dbPhotos = getPhotosForJob<InspectionPhoto>(jobId);
      set({ photos: dbPhotos, isLoading: false });
    } catch (err: unknown) {
      console.error('[PhotosStore] loadPhotos error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  addPhoto: (photoData) => {
    try {
      const id = generateUUID();
      const newPhoto: InspectionPhoto = {
        ...photoData,
        id,
        uploaded_at: new Date().toISOString(),
        // Store the original device file path in local_uri so offline PDF
        // generation can access the local file even after photo_url is replaced
        // with the Supabase https:// public URL by processPhotoQueue.
        local_uri: (
          photoData.photo_url.startsWith('file://') ||
          photoData.photo_url.startsWith('content://')
        ) ? photoData.photo_url : (photoData.local_uri ?? null),
      };

      // 1. Persist locally with the file:// URI immediately (offline-safe)
      insertRecord('inspection_photos', newPhoto as Record<string, string | number | boolean | null>);

      // 2. Queue the binary upload — processPhotoQueue in sync.ts handles this.
      //    BUG 8 FIX: do NOT also queue a SyncOperation.Insert here with the local file:// URI
      //    because sync.ts would push the broken local path to Supabase BEFORE the upload completes.
      //    processPhotoQueue will insert the Supabase row AFTER upload succeeds with the public URL.
      queuePhotoUpload(newPhoto.photo_url, newPhoto.job_id, newPhoto.asset_id ?? undefined, id, newPhoto.defect_id ?? undefined);

      set((state) => ({ photos: [newPhoto, ...state.photos] }));
    } catch (err: unknown) {
      console.error('[PhotosStore] addPhoto error:', err);
      set({ error: errorMessage(err) });
    }
  },

  deletePhoto: (photoId) => {
    try {
      const photo = get().photos.find((p) => p.id === photoId);
      const photoUrl = photo?.photo_url;

      // 1. Remove from local SQLite immediately
      deleteRecord('inspection_photos', photoId);

      // 2. Permanently record in tombstone — survives retries/reinstalls
      recordDeletedPhoto(photoId);

      if (photoUrl?.startsWith('https://')) {
        // Photo already uploaded to Supabase — queue a delete for both the DB row
        // and the Storage binary (sync.ts _pushQueue handles the binary deletion).
        addToSyncQueue('inspection_photos', photoId, SyncOperation.Delete, {
          id: photoId,
          photo_url: photoUrl,
        });
      } else {
        // Photo only exists locally (file:// URI, never uploaded).
        // Cancel the pending photo_upload task so it is never sent to Supabase.
        // No Supabase row exists yet, so no DB delete is needed.
        cancelPendingPhotoUpload(photoId);
      }

      set((state) => ({ photos: state.photos.filter((p) => p.id !== photoId) }));
    } catch (err: unknown) {
      console.error('[PhotosStore] deletePhoto error:', err);
      set({ error: errorMessage(err) });
    }
  },


  updateCaption: (photoId, caption) => {
    try {
      updateRecord('inspection_photos', photoId, { caption });
      addToSyncQueue('inspection_photos', photoId, SyncOperation.Update, { caption });
      set((state) => ({
        photos: state.photos.map((p) =>
          p.id === photoId ? { ...p, caption } : p
        ),
      }));
    } catch (err: unknown) {
      console.error('[PhotosStore] updateCaption error:', err);
      set({ error: errorMessage(err) });
    }
  },

  getPendingCount: () => {
    const { photos } = get();
    // Both file:// (iOS/Android temp files) and content:// (Android media store)
    // indicate the photo binary hasn't been uploaded to Supabase Storage yet.
    return photos.filter(
      (p) => p.photo_url.startsWith('file://') || p.photo_url.startsWith('content://')
    ).length;
  },

  clearError: () => set({ error: null }),
}
```

*Size: **146** lines of code.*

---

## 📄 `store/quotesStore.ts`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Zustand state store. **We expect this to hold global state variables and provide mutator functions to React components.**

### Core Code Logic & Implementations:

#### `const useQuotesStore`
```tsx
export const useQuotesStore = create<QuotesState>((set, get) => ({
  currentQuote: null,
  items: [],
  isLoading: false,
  error: null,
  _syncListenerRef: null,

  loadQuoteForJob: (jobId) => {
    try {
      // FLOW-9 FIX: Clear previous job's quote immediately so navigating
      // from Job A (£500) to Job B (no quote) never flashes "£500".
      set({ currentQuote: null, items: [], isLoading: true, error: null });
      const db = openDatabase();
      // Use ORDER BY created_at DESC to always get the most recent quote,
      // not an arbitrary one — guards against duplicates during offline sync conflicts
      const quote = db.getFirstSync<Quote>(
        `SELECT * FROM quotes WHERE job_id = ? ORDER BY created_at DESC LIMIT 1`,
        [jobId]
      );
      if (quote) {
        const items = queryRecords<QuoteItem>('quote_items', { quote_id: quote.id });
        set({ currentQuote: quote, items, isLoading: false });
      } else {
        set({ currentQuote: null, items: [], isLoading: false });
      }
    } catch (err: unknown) {
      console.error('[QuotesStore] loadQuoteForJob error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  createDraftQuote: (jobId) => {
    try {
      const id = generateUUID();
      const payload: Quote = {
        id,
        job_id: jobId,
        status: QuoteStatus.Draft,
        total_amount: 0,
        created_at: new Date().toISOString(),
      };
      insertRecord('quotes', payload as Record<string, string | number | boolean | null>);
      addToSyncQueue('quotes', id, SyncOperation.Insert, payload as Record<string, string | number | boolean | null>);
      set({ currentQuote: payload, items: [], error: null });
    } catch (err: unknown) {
      console.error('[QuotesStore] createDraftQuote error:', err);
      set({ error: errorMessage(err) });
    }
  },

  addItem: (inventoryItemId, defectId, quantity) => {
    try {
      const { currentQuote, items } = get();
      if (!currentQuote) return;

      // C4 fix: if an item with the same inventory+defect combo already exists,
      // increment its quantity instead of inserting a duplicate row.
      const existing = items.find(
        (i) => i.inventory_item_id === inventoryItemId && i.defect_id === defectId
      );
      if (existing) {
        const newQty = existing.quantity + quantity;
        updateRecord('quote_items', existing.id, { quantity: newQty });
        addToSyncQueue('quote_items', existing.id, SyncOperation.Update, { quantity: newQty });

        const newItems = items.map((i) => i.id === existing.id ? { ...i, quantity: newQty } : i);
        // Round to 2 decimal places to prevent floating-point accumulation errors
        const newTotal = Math.round(newItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) * 100) / 100;
        const updatedQuote: Quote = { ...currentQuote, total_amount: newTotal };
        updateRecord('quotes', currentQuote.id, { total_amount: newTotal });
        addToSyncQueue('quotes', currentQuote.id, SyncOperation.Update, { total_amount: newTotal });
        set({ items: newItems, currentQuote: updatedQuote });
        return;
      }

      // New item — resolve price from inventory store
      const invItem = useInventoryStore.getState().items.find((i) => i.id === inventoryItemId);
      const unitPrice = invItem?.price ?? 0;

      const id = generateUUID();
      const payload: QuoteItem = {
        id,
        quote_id: currentQuote.id,
        inventory_item_id: inventoryItemId,
        defect_id: defectId,
        quantity,
        unit_price: unitPrice,
      };

      insertRecord('quote_items', payload as Record<string, string | number | boolean | null>);
      addToSyncQueue('quote_items', id, SyncOperation.Insert, payload as Record<string, string | number | boolean | null>);

      const newItems = [...items, payload];
      // Round to 2 decimal places to prevent floating-point accumulation errors
      const newTotal = Math.round(newItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) * 100) / 100;

      const updatedQuote: Quote = { ...currentQuote, total_amount: newTotal };
      updateRecord('quotes', currentQuote.id, { total_amount: newTotal });
      addToSyncQueue('quotes', currentQuote.id, SyncOperation.Update, { total_amount: newTotal });

      set({ items: newItems, currentQuote: updatedQuote });
    } catch (err: unknown) {
      console.error('[QuotesStore] addItem error:', err);
      set({ error: errorMessage(err) });
    }
  },

  removeItem: (itemId) => {
    try {
      const { currentQuote, items } = get();
      if (!currentQuote) return;

      deleteRecord('quote_items', itemId);
      addToSyncQueue('quote_items', itemId, SyncOperation.Delete, { id: itemId });

      const newItems = items.filter((i) => i.id !== itemId);
      // Round to 2 decimal places to prevent floating-point accumulation errors
      const newTotal = Math.round(newItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) * 100) / 100;

      const updatedQuote: Quote = { ...currentQuote, total_amount: newTotal };
      updateRecord('quotes', currentQuote.id, { total_amount: newTotal });
      addToSyncQueue('quotes', currentQuote.id, SyncOperation.Update, { total_amount: newTotal });

      set({ items: newItems, currentQuote: updatedQuote });
    } catch (err: unknown) {
      console.error('[QuotesStore] removeItem error:', err);
      set({ error: errorMessage(err) });
    }
  },

  approveQuote: () => {
    const { currentQuote } = get();
    if (!currentQuote) return;
    // Guard: cannot approve a quote that is already approved
    if (currentQuote.status === QuoteStatus.Approved) return;

    try {
      const updatedQuote: Quote = { ...currentQuote, status: QuoteStatus.Approved };
      updateRecord('quotes', currentQuote.id, { status: QuoteStatus.Approved });
      addToSyncQueue('quotes', currentQuote.id, SyncOperation.Update, { status: QuoteStatus.Approved });
      set({ currentQuote: updatedQuote });
    } catch (err: unknown) {
      console.error('[QuotesStore] approveQuote error:', err);
      set({ error: errorMessage(err) });
    }
  },

  clearError: () => set({ error: null }),

  subscribeToSync: (jobId: string) => {
    // Clean up any previously registered listener before subscribing again
    const prev = get()._syncListenerRef;
    if (prev) offSyncComplete(prev);

    const listener = () => {
      if (__DEV__) console.log('[QuotesStore] sync complete — reloading quote');
      useQuotesStore.getState().loadQuoteForJob(jobId);
    };
    onSyncComplete(listener);
    set({ _syncListenerRef: listener });
  },

  unsubscribeFromSync: () => {
    const listener = get()._syncListenerRef;
    if (listener) {
      offSyncComplete(listener);
      set({ _syncListenerRef: null });
    }
  },
}
```

*Size: **212** lines of code.*

---

# 📁 `types/` Directory

## 📄 `types/index.ts`

> **Description:** types/index.ts Full TypeScript interfaces for all SiteTrack domain models, API responses, and form types. These MUST stay in sync with the SQLite schema in lib/database.ts (schema v29) and the Supabase remote schema. Audit rule: every field that exists in the SQLite schema must exist here. Missing fields cause silent data loss — the field is fetched from DB but TypeScript won't tell you it exists.
>
> **What we expect from it:** Core system file.

### Core Code Logic & Implementations:

#### `type User`
```tsx
export interface User {
  id: string;                         // uuid — references auth.users
  company_id: string | null;          // required for RLS — never undefined
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  push_token: string | null;          // Expo push notification token
  is_active: boolean;
  // FPAS licence fields (v22 migration)
  fpas_number: string | null;
  fpas_class: string | null;
  fpas_expiry: string | null;
  // State licence fields (v23 migration)
  state_license: string | null;
  state_license_expiry: string | null;
  // ToS / AUP acceptance timestamps (v26 migration)
  accepted_tos_at: string | null;
  accepted_aup_at: string | null;
  created_at: string;                 // ISO 8601 timestamptz
  updated_at: string;
}
```

#### `type Property`
```tsx
export interface Property {
  id: string;
  company_id: string | null;
  name: string;
  address: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  access_notes: string | null;
  hazard_notes: string | null;
  site_note: string | null;
  compliance_status: ComplianceStatus;
  next_inspection_date: string | null;
  created_at: string;
  updated_at: string;
}
```

#### `type Asset`
```tsx
export interface Asset {
  id: string;
  company_id: string | null;
  property_id: string;
  asset_type: string;
  /** Sub-variant of the asset type (e.g. 'DCP AB(E) 4.5KG') */
  variant: string | null;
  /** Short technician reference number (e.g. '001', '040') */
  asset_ref: string | null;
  description: string | null;
  location_on_site: string | null;
  serial_number: string | null;
  barcode_id: string | null;
  install_date: string | null;        // ISO 8601 date
  last_service_date: string | null;
  next_service_date: string | null;
  status: AssetStatus;
  created_at: string;
  updated_at: string;
}
```

#### `type Job`
```tsx
export interface Job {
  id: string;
  company_id: string | null;
  property_id: string;
  assigned_to: string;                // user id
  job_type: JobType;
  status: JobStatus;
  scheduled_date: string;             // ISO 8601 date
  scheduled_time: string | null;      // HH:MM
  priority: Priority;
  notes: string | null;
  report_url: string | null;          // generated PDF URL stored after report creation
  created_at: string;
  updated_at: string;

  // Joined relations (populated from JOIN queries, not columns)
  property?: Property;
  assigned_user?: User;
}
```

#### `type JoinedJob`
```tsx
export interface JoinedJob extends Job {
  property_name:           string | null;
  property_address:        string | null;
  property_suburb:         string | null;
  property_state:          string | null;
  property_postcode:       string | null;
  property_compliance:     string | null;
  site_contact_name:       string | null;
  site_note:               string | null;
}
```

#### `type TechUser`
```tsx
export interface TechUser extends User {
  fpas_number:   string | null | undefined;
  fpas_class:    string | null | undefined;
  state_license: string | null | undefined;
}
```

#### `type JobAsset`
```tsx
export interface JobAsset {
  id: string;
  company_id: string | null;
  job_id: string;
  asset_id: string;
  result: InspectionResult | null;
  checklist_data: string | null;      // JSON string of checklist answers
  is_compliant: boolean;
  defect_reason: string | null;
  technician_notes: string | null;
  actioned_at: string | null;

  // Joined relation (populated from JOIN queries)
  asset?: Asset;
}
```

#### `type Defect`
```tsx
export interface Defect {
  id: string;
  company_id: string | null;
  job_id: string;
  asset_id: string;
  property_id: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  photos: string[];                   // array of photo_urls or local file URIs
  created_at: string;
  updated_at: string | null;
  /** Uptick defect code (e.g. 'bg', 'hg') — null for free-text defects */
  defect_code: string | null;
  /** Reference quote price in AUD from the Uptick code library */
  quote_price: number | null;
}
```

#### `type InspectionPhoto`
```tsx
export interface InspectionPhoto {
  id: string;
  company_id: string | null;
  job_id: string;
  asset_id: string | null;
  defect_id: string | null;
  /**
   * Supabase Storage CDN URL after upload, or a local file:// URI before upload.
   * Never use this as the display URL without checking — use local_uri as a fallback
   * for offline PDF generation.
   */
  photo_url: string;
  /**
   * Original device file:// path. Preserved after upload so offline PDF generation
   * can fall back to the local copy instead of failing with a placeholder image.
   * Set to null by cleanupLocalPhotos() after the 15-day retention window.
   */
  local_uri: string | null;
  caption: string | null;
  uploaded_at: string;
  /** user id — null when captured offline before session is confirmed */
  uploaded_by: string | null;
}
```

#### `type Signature`
```tsx
export interface Signature {
  id: string;
  company_id: string | null;
  job_id: string;                     // UNIQUE — one signature set per job
  /** Client signature — base64 PNG data URI or Supabase Storage URL */
  signature_url: string;
  /** Technician sign-off — AS1851 compliance requires tech signature (v19 migration) */
  tech_signature_url: string | null;
  signed_by_name: string;
  signed_at: string;
  /** Device info at time of signing (OS, app version) — for audit trail (v28 migration) */
  device_info: string | null;
}
```

#### `type TimeLog`
```tsx
export interface TimeLog {
  id: string;
  company_id: string | null;
  job_id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  travel_time_minutes: number | null;
}
```

#### `type InventoryItem`
```tsx
export interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  created_at: string;
}
```

#### `type Quote`
```tsx
export interface Quote {
  id: string;
  company_id: string | null;
  job_id: string;
  status: QuoteStatus;
  total_amount: number;
  created_at: string;
}
```

#### `type QuoteItem`
```tsx
export interface QuoteItem {
  id: string;
  company_id: string | null;
  quote_id: string;
  /**
   * References inventory_items — null for custom line items where the
   * technician typed a free-text item_name instead of selecting from catalogue.
   */
  inventory_item_id: string | null;
  defect_id: string | null;
  quantity: number;
  unit_price: number;
  /** Custom item name for non-catalogue line items (v27 migration) */
  item_name: string | null;
}
```

#### `type SyncQueueItem`
```tsx
export interface SyncQueueItem {
  id: number;                         // SQLite autoincrement
  table_name: string;
  record_id: string;
  /**
   * The sync operation type. Includes the special 'photo_upload' pseudo-operation
   * used by photoUpload.ts to queue binary uploads separately from DB row inserts.
   */
  operation: SyncOperation | 'photo_upload';
  payload: string;                    // JSON.stringify'd record data
  synced: number;                     // 0=pending, 1=done, -1=permanently failed
  retry_count: number;                // incremented on each failed push attempt
  last_error: string | null;          // last error message from a failed push
  created_at: string;
}
```

#### `type ApiResponse`
```tsx
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}
```

#### `type PaginatedResponse`
```tsx
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  error: string | null;
}
```

#### `type LoginForm`
```tsx
export interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}
```

#### `type InspectionForm`
```tsx
export interface InspectionForm {
  job_asset_id: string;
  result: InspectionResult;
  defect_reason?: string;
  technician_notes?: string;
}
```

#### `type DefectForm`
```tsx
export interface DefectForm {
  job_id: string;
  asset_id: string;
  property_id: string;
  description: string;
  severity: DefectSeverity;
  photos: string[];                   // local file URIs before upload
}
```

#### `type SyncStatus`
```tsx
export interface SyncStatus {
  lastSynced: string | null;          // ISO 8601 or null if never synced
  pendingCount: number;
  /** Items that permanently failed after MAX_SYNC_RETRIES — never auto-retried */
  failedCount: number;
  isOnline: boolean;
}
```

#### `type Coordinates`
```tsx
export interface Coordinates {
  latitude: number;
  longitude: number;
}
```

*Size: **353** lines of code.*

---

# 📁 `utils/` Directory

## 📄 `utils/assetHelpers.ts`

> **Description:** assetHelpers.ts — Display helpers for fire-safety asset types and variants. Delegates to AssetData.ts for all icon/colour lookups so there is only one source of truth.
>
> **What we expect from it:** Utility functions. **We expect pure functions that take inputs and return formatted or sanitized outputs.**

### Core Code Logic & Implementations:

#### `function formatAssetType`
```tsx
export function formatAssetType(assetType: string): string {
  if (!assetType) return '';

  // If it's a known official type, return its fullLabel
  if (ASSET_TYPE_MAP[assetType]) {
    return ASSET_TYPE_MAP[assetType].fullLabel;
  }

  // Legacy snake_case or freeform — Title Case conversion
  return assetType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

#### `function getAssetEmoji`
```tsx
export function getAssetEmoji(assetType: string): string {
  const t = (assetType ?? '').toLowerCase();
  if (t.includes('extinguisher'))                      return '🧯';
  if (t.includes('sprinkler'))                         return '💧';
  if (t.includes('exit sign') || t.includes('exit'))  return '🚪';
  if (t.includes('emergency') && t.includes('light')) return '🔦';
  if (t.includes('emergency'))                         return '⚡';
  if (t.includes('fire detection') || t.includes('detector') || t.includes('smoke')) return '🔔';
  if (t.includes('fire door') || t.includes('door'))  return '🚪';
  if (t.includes('hose'))                              return '🚿';
  if (t.includes('hydrant'))                           return '🔴';
  if (t.includes('mcp') || t.includes('call point') || t.includes('manual call')) return '🆘';
  return '🔥';
}
```

*Size: **65** lines of code.*

---

## 📄 `utils/fileHelpers.ts`

> **Description:** utils/fileHelpers.ts Fix summary (this revision): 1. getValidLocalUri: preserves subdirectory structure, not just the filename. Previously `file:///old-session/subdir/photo.jpg` would resolve to `file:///new-session/photo.jpg` (missing subdir), causing FileSystem reads to fail. 2. getValidLocalUri: strips query strings from filenames before reconstruction. 3. getValidLocalUri: returns early if uri already points to the current documentDirectory (avoids redundant stat calls on every render). 4. Added safeFilename helper for generating collision-resistant local filenames.
>
> **What we expect from it:** Utility functions. **We expect pure functions that take inputs and return formatted or sanitized outputs.**

### Core Code Logic & Implementations:

#### `function getValidLocalUri`
```tsx
export function getValidLocalUri(uri: string | null | undefined): string {
  if (!uri) return '';

  // Remote URLs and data URIs are unaffected by session path changes
  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('data:')
  ) {
    return uri;
  }

  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) return uri;

  // Already points to current session directory — no reconstruction needed
  if (uri.startsWith(baseDir)) return uri;

  // Extract the filename.
  // We don't use subdirectories for image storage in this app.
  // Taking the last path component perfectly adapts the URI to the new session's baseDir.
  const withoutQuery = uri.split('?')[0];
  const filename = withoutQuery.split('/').pop() ?? '';
  
  if (!filename) return uri;
  
  // baseDir already includes the trailing slash
  return `${baseDir}${filename}`;
}
```

#### `function safeFilename`
```tsx
export function safeFilename(extension = 'jpg'): string {
  const ts     = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `photo_${ts}_${random}.${extension}`;
}
```

*Size: **78** lines of code.*

---

## 📄 `utils/sanitize.ts`

> **Description:** utils/sanitize.ts Input sanitization helpers for all user-facing TextInput fields. Principles: 1. Be generous — never block legitimate field data (names, addresses, notes) 2. Strip/reject only known attack patterns (script tags, SQL meta-chars, event handlers) 3. Enforce sensible field-level length limits (prevents DB bloat + PDF overflow) 4. All functions are pure — no side effects, safe to call in onChange handlers
>
> **What we expect from it:** Utility functions. **We expect pure functions that take inputs and return formatted or sanitized outputs.**

### Core Code Logic & Implementations:

#### `function stripHtml`
```tsx
export function stripHtml(value: string): string {
  return value
    // Remove <script> blocks entirely (content + tags)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove all other HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove javascript: pseudo-protocol
    .replace(/javascript\s*:/gi, '')
    // Remove data: URIs
    .replace(/data\s*:[^;]*;/gi, '')
    // Remove on* event handler attributes (e.g. onclick, onerror, onload)
    .replace(/\bon\w+\s*=/gi, '')
    .trim();
}
```

#### `function sanitizeText`
```tsx
export function sanitizeText(value: string, maxLength: number): string {
  if (!value) return '';
  return stripHtml(value).substring(0, maxLength).trim();
}
```

#### `function sanitizeForHtml`
```tsx
export function sanitizeForHtml(
  value: string | null | undefined,
  maxLength: number = MAX_LENGTHS.reportText,
): string {
  if (!value) return '';
  // First strip injection patterns, then HTML-encode what remains
  const cleaned = stripHtml(value).substring(0, maxLength);
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

#### `function sanitizeForDisplay`
```tsx
export function sanitizeForDisplay(
  value: string | null | undefined,
  maxLength: number = MAX_LENGTHS.notes,
): string {
  if (!value) return '';
  return stripHtml(value).substring(0, maxLength);
}
```

#### `const MAX_LENGTHS`
```tsx
export const MAX_LENGTHS = {
  /** Names: person names, property names, company names */
  name:         120,
  /** Email addresses */
  email:        254,
  /** Phone numbers (international) */
  phone:         30,
  /** Street address lines */
  address:      200,
  /** Suburb / city */
  suburb:        80,
  /** State / territory (usually abbreviation) */
  state:         60,
  /** Postcode */
  postcode:      10,
  /** Short reference codes (asset ref, serial, barcode) */
  reference:     50,
  /** Short single-line text (job type, status labels) */
  shortText:    100,
  /** Standard notes / description fields */
  notes:        1000,
  /** Long-form text (access notes, hazard notes, inspection notes) */
  longNotes:    2000,
  /** PDF / report text — capped to prevent layout breaking */
  reportText:   500,
}
```

*Size: **138** lines of code.*

---

## 📄 `utils/uuid.ts`

> **Description:** Cryptographically-secure RFC-4122 v4 UUID generator. Uses expo-crypto (backed by the OS CSPRNG: SecRandomCopyBytes on iOS, java.security.SecureRandom on Android) instead of Math.random(). Math.random() is NOT cryptographically secure — it is predictable and should never be used for IDs that are used as primary keys in a database or as unguessable identifiers in URLs/links. Falls back to Math.random() only if expo-crypto is unavailable (web/test env).
>
> **What we expect from it:** Utility functions. **We expect pure functions that take inputs and return formatted or sanitized outputs.**

### Core Code Logic & Implementations:

#### `function generateUUID`
```tsx
export function generateUUID(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    // Fallback for environments where expo-crypto native module is unavailable
    // (e.g. Expo Go web, Jest unit tests). NOT for production use.
    if (__DEV__) console.warn('[UUID] expo-crypto unavailable — falling back to Math.random(). Not for production.');
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
```

*Size: **29** lines of code.*

---

# 📁 `supabase/` Directory

## 📄 `supabase/migrations/add_property_next_inspection.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- 1. Add the column to the properties table
ALTER TABLE public.properties 
ADD COLUMN next_inspection_date DATE;

-- 2. Add comment for documentation
COMMENT ON COLUMN public.properties.next_inspection_date IS 
  'Date when the site is next due for a full inspection. Replaces asset-level next_service_date.';
```

*Size: **8** lines of code.*

---

## 📄 `supabase/migrations/catalogue_migration.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- ============================================================
-- UMA BUILDING SERVICES — Catalogue Migration
-- Run this ONCE in the Supabase SQL editor.
-- Creates asset_type_definitions + defect_codes tables and
-- seeds them with all data currently in the TypeScript constants.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLE: asset_type_definitions
-- Admin-managed catalogue of fire-safety asset types.
-- Mirrors constants/AssetData.ts ASSET_TYPES (source of truth
-- after this migration is applied).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_type_definitions (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  value               TEXT        NOT NULL UNIQUE,
  label               TEXT        NOT NULL,
  full_label          TEXT        NOT NULL,
  icon                TEXT        NOT NULL DEFAULT 'shield-check-outline',
  color               TEXT        NOT NULL DEFAULT '#6B7280',
  inspection_routine  TEXT        NOT NULL DEFAULT 'General Inspection (Annual)',
  variants            TEXT[]      NOT NULL DEFAULT '{}',
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT asset_type_definitions_pkey PRIMARY KEY (id)
);

ALTER TABLE public.asset_type_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_types_select_auth" ON public.asset_type_definitions;
CREATE POLICY "asset_types_select_auth" ON public.asset_type_definitions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- TABLE: defect_codes
-- Admin-managed library of defect codes and reference prices.
-- Mirrors constants/DefectCodes.ts DEFECT_CODES.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.defect_codes (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  description TEXT        NOT NULL,
  quote_price NUMERIC,
  category    TEXT        NOT NULL DEFAULT 'General',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT defect_codes_pkey PRIMARY KEY (id)
);

ALTER TABLE public.defect_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "defect_codes_select_auth" ON public.defect_codes;
CREATE POLICY "defect_codes_select_auth" ON public.defect_codes
  FOR SELECT USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT FUNCTION (create if not exists)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGERS
-- ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS asset_type_definitions_updated_at ON public.asset_type_definitions;
CREATE TRIGGER asset_type_definitions_updated_at
  BEFORE UPDATE ON public.asset_type_definitions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS defect_codes_updated_at ON public.defect_codes;
CREATE TRIGGER defect_codes_updated_at
  BEFORE UPDATE ON public.defect_codes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- SEED: asset_type_definitions
-- One-time seed from constants/AssetData.ts
-- ────────────────────────────────────────────────────────────

INSERT INTO public.asset_type_definitions (value, label, full_label, icon, color, inspection_routine, variants, sort_order)
VALUES
  (
    'BGA, MCP or Manual Call Point',
    'MCP / Call Point',
    'BGA, MCP or Manual Call Point',
    'alarm-light',
    '#7C3AED',
    'Access Control System (Annual)',
    ARRAY['Break Glass'],
    1
  ),
  (
    'Emergency - Exit Signs',
    'Exit Signs',
    'Emergency - Exit Signs',
    'exit-run',
    '#059669',
    '15 - Emergency escape lighting and exit signs (Annual)',
    ARRAY[
      'Blade (Ceiling Mount) - Exit','Blade (Recessed) - Exit','Box (Wall Mount) - Exit',
      'Exit Sign (Non-Illuminated)','Exit Sign (Thin Blade)','Exit Sign Gear Tray',
      'Exit Sign Weather Proof','Exit Sign Wide Body','Jumbo (Ceiling Mount) - Exit',
      'Jumbo (Wall Mount) - Exit','Pyramid (Ceiling Mount) - Exit',
      'Quick Fit (Ceiling Mount geartray) - Exit','Quick Fit (Ceiling Mount) - Exit',
      'Quick Fit (Wall Mount) - Exit','Weatherproof (Ceiling Mount) - Exit',
      'Weatherproof (Wall Mount) - Exit'
    ],
    2
  ),
  (
    'Emergency - Lighting',
    'Emergency Lighting',
    'Emergency - Lighting',
    'lightning-bolt',
    '#F59E0B',
    '15 - Emergency escape lighting and exit signs (Annual)',
    ARRAY[
      '1FT - Geartray Diffused','2FT - Single Bare Batten','2FT - Single Diffused Batten',
      '2FT - Single Weatherproof Batten','2FT - Single Wireguard Batten','2FT - Twin Bare Batten',
      '2FT - Twin Diffused Batten','2FT - Twin Weatherproof Batten','2FT - Twin Wireguard Batten',
      '4FT - Single Bare Batten','4FT - Single Diffused Batten','4FT - Single Weatherproof Batten',
      '4FT - Single Wireguard Batten','4FT - Twin Bare Batten','4FT - Twin Diffused Batten',
      '4FT - Twin Weatherproof Batten','4FT - Twin Wireguard Batten','Box Ceiling/Wall',
      'Circuit Breaker','Flood Twin','Flood Twin Weatherproof','Main Switch Board',
      'Oyster','Oyster (Weatherproof)','Panel LED T-Bar','Spitfire (Flush Mount)',
      'Spitfire - (Surface Mount)','Square Ceiling/Wall - Light','Test Switch'
    ],
    3
  ),
  (
    'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)',
    'Fire Detection',
    'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)',
    'smoke-detector',
    '#DC2626',
    '06 - Fire Detection (Devices) (Annual)',
    ARRAY[
      'ASE (Alarm Monitoring)','Beam Detector','Bell','Detector - Co2',
      'Detector - Concealed Heat','Detector - Concealed Smoke','Detector - Flame',
      'Detector - Heat','Detector - Smoke','Duct probe','Emergency Door Release',
      'Fail Safe Device','Flow Switch','Horn (Single)','Horn (Twin)',
      'MCP (Indoor)','MCP (Weatherproof)','Pressure Switch','Sounder','Strobe','Vesda'
    ],
    4
  ),
  (
    'Fire Door (CA)',
    'Fire Door',
    'Fire Door (CA)',
    'door',
    '#8B5CF6',
    '12 - Passive Fire (Hinged and Pivoted Doorsets - Common) (Annual)',
    ARRAY[
      'Automatic Door','Exit Door - Double Even pair','Exit Door - Double Uneven pair',
      'Exit Door - Single','Fire Door - Double Even pair','Fire Door - Double Uneven pair',
      'Fire Door - Single','Fire Door - Single Double Action','Fire Safety Door',
      'Smoke & Fire Door - Single','Smoke Door - Double Even Pair','Smoke Door - Double Uneven pair',
      'Smoke Door - Single','Smoke Door - Single Double Action','Smoke Door - Uneven Pair',
      'Solid Core Doorset - Double','Solid Core Doorset - Single'
    ],
    5
  ),
  (
    'Fire Extinguishers - Portable',
    'Fire Extinguisher',
    'Fire Extinguishers - Portable',
    'fire-extinguisher',
    '#EF4444',
    '10 - Portable and Wheeled Fire Extinguishers (Annual)',
    ARRAY[
      'Air/Water 9.0LT','CO2 2.0KG','CO2 3.5KG','CO2 5.0KG',
      'DCP AB(E) 1.0KG','DCP AB(E) 1.5KG','DCP AB(E) 2.0KG','DCP AB(E) 2.3KG',
      'DCP AB(E) 2.5KG','DCP AB(E) 4.5KG','DCP AB(E) 6.0KG','DCP AB(E) 9.0KG',
      'DCP B(E) 2.3KG','DCP B(E) 4.5KG','DCP B(E) 9.0KG','Foam AFFF 9.0LT',
      'Foam F3 (Fluorine Free) 9.0LT','Wet Chemical 2.0Lt','Wet Chemical 7.0Lt'
    ],
    6
  ),
  (
    'Fire Hose Reels',
    'Hose Reels',
    'Fire Hose Reels',
    'pipe',
    '#0891B2',
    '09 - Fire Hose Reels (Annual)',
    ARRAY[
      '100m - 19mm - Fire','100m - 25mm - Fire','36m - 19mm - Green Wash Down',
      '36m - 19mm - Fire','36m - 25mm - Fire','50m - 19mm - Fire',
      '50m - 25mm - Fire','Fire Hose Reel Flow Test'
    ],
    7
  ),
  (
    'Fire Hydrant System',
    'Fire Hydrant',
    'Fire Hydrant System',
    'pipe-valve',
    '#B91C1C',
    '04 - Fire Hydrant Systems (Annual - Valves)',
    ARRAY[
      '20Lt Foam pail','Booster - Hydrant','Booster - Sprinkler',
      'Hydrant System Flow test','Hydrant landing valves',
      'In-ground Spring Hydrant','Pillar Landing Valve','Sprinkler head'
    ],
    8
  ),
  (
    'Fire Sprinkler System - Wet Pipe',
    'Sprinkler System',
    'Fire Sprinkler System - Wet Pipe',
    'water',
    '#2563EB',
    '02 - Automatic Fire Sprinkler Systems (Annual Flow)',
    ARRAY[
      'Foam Water Systems','General System','Sprinkler Alarm Valve',
      'Sprinkler System Flow Test','Sprinkler Valve','Sprinkler head',
      'Wall Wetting System','Window Wetter System','sprinkler (heads) cabinet'
    ],
    9
  )
ON CONFLICT (value) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SEED: defect_codes
-- One-time seed from constants/DefectCodes.ts
-- ────────────────────────────────────────────────────────────

INSERT INTO public.defect_codes (code, description, quote_price, category, sort_order)
VALUES
  ('anf','Alarm not indicated on FIP — require investigation $85/hr',NULL,'Alarm',1),
  ('bb','Broken Button exposing Circuit Board',NULL,'Hardware',2),
  ('bed','Bottom Edge Delamination',250,'Delamination',3),
  ('bg','Bottom Gap (10–15mm) — Confirm the gap size; if >10mm then install fire rated seal at additional $135.00+GST',NULL,'Gap',4),
  ('bgx','Bottom Gap (15–25mm)',250,'Gap',5),
  ('bosa','Battery Only Smoke Alarm (Require to be 240V Smoke Alarm)',NULL,'Alarm',6),
  ('brk','BRK 10yrs+ Expired',NULL,'Alarm',7),
  ('bsc','Bottom Side Contact',75,'Hardware',8),
  ('bss','Bottom Smoke Seal requires adjusting; if adjustment fails then replace Seal $135.00',25,'Seal',9),
  ('bsx','Bottom Smoke Seal External requires adjusting; if adjustment fails then replace Seal $125.00',25,'Seal',10),
  ('cdla','Cut out in Fire Door for dead latch installation & non-compliant wrong type of deadlatch door strike installed',295,'Lock',11),
  ('Covid','No access due to sickness or self-isolating or covid restrictions. Require Re-inspection with no extra cost.',NULL,'Access',12),
  ('cs','Constant Sounding Fault',NULL,'Alarm',13),
  ('da','Closer detached arm — service hardware',25,'Hardware',14),
  ('db','Non-Compliant Dead-Bolt (Remove & replace with SS Plating & Fire Sealant)',95,'Lock',15),
  ('dc','Damaged Closer',165,'Hardware',16),
  ('dde','Damage on the door edge (SS Plating & Fire Sealant)',250,'Delamination',17),
  ('ddex','Large Damage on the door edge (SS Custom Plating & Fire Sealant)',350,'Delamination',18),
  ('df','Damaged/tampered physically, failed',NULL,'General',19),
  ('dh','Damaged Hinge — attempt a minor repair (if welding required $400.00+GST & fire detection Isolations $250.00+GST)',75,'Hinge',20),
  ('dl','Non-Compliant Dead-Lock (Remove & replace with SS Plating & Fire Sealant)',90,'Lock',21),
  ('dla','Non-Compliant Dead-Latch (Remove & replace with SS Plating & Fire Sealant)',90,'Lock',22),
  ('ds','Door Strike in Frame damaged/modified (Welding Required & may require Fire Detection Isolations $250.00+GST)',400,'Hardware',23),
  ('el','Non-Compliant Electronic Lock (Remove & replace with Compliant Dead-Latch with a scar plate, fire sealant and or SS filler plate)',325,'Lock',24),
  ('ep','Escutcheon ring(s) & base(s) — missing/corroded — require replacing',195,'Hardware',25),
  ('ewls','EWIS speaker(s) low sound — require investigation $85.00+GST/hr & may require replacing $150.00+GST ea',NULL,'Alarm',26),
  ('ewns','EWIS speaker(s) no sound — require investigation $85.00+GST/hr & may require replacing $150.00+GST ea',NULL,'Alarm',27),
  ('exp','Exceed 10yr service Life',NULL,'Compliance',28),
  ('f','Fail',NULL,'General',29),
  ('fc','Faulty Closer Leaking Hydraulic Oil',165,'Hardware',30),
  ('fnf','Fault not indicated on FIP — require investigation $85/hr',NULL,'Alarm',31),
  ('fs','Non fire rated foam seal — require to remove',50,'Seal',32),
  ('h','Hole(s) in Door or Frame, Require Fire Rated Putty/Sealant.',25,'General',33),
  ('hd','The closer is warped out and too weak to close the door. It requires to be replaced with the heavy duty closer.',175,'Hardware',34),
  ('hed','Hinge Edge Delamination',250,'Delamination',35),
  ('hg','Hinge Gap',75,'Gap',36),
  ('hg5','Hinge Gap half Length',35,'Gap',37),
  ('hgt','Hinge Gap exceeding 3mm due to the door edge planed with a taper',NULL,'Gap',38),
  ('hgx','Hinge Gap 8mm+ (Recheck gap size)',75,'Gap',39),
  ('hss','Hinge Inside Smoke Seal damaged/Missing (Required to be Replaced)',45,'Seal',40),
  ('hsx','Hinge External Smoke Seal damaged/Missing (Required to be Replaced)',55,'Seal',41),
  ('ip','Suspected non-approved partition(s) or subdivision(s) found',NULL,'Compliance',42),
  ('led','Lock Edge Delamination',215,'Delamination',43),
  ('lg','Lock side Gap',75,'Gap',44),
  ('lg5','Lock side Gap half Length',35,'Gap',45),
  ('lgt','Lock Side Gap exceeding 3mm due to the door edge planed with a taper',NULL,'Gap',46),
  ('lgx','Lock side Gap 8mm+',75,'Gap',47),
  ('lp','Latch Plate (Damaged/Missing)',20,'Hardware',48),
  ('ls','Low Sound Fault',NULL,'Alarm',49),
  ('lsc','Lock Side Contact, require to rehang door',75,'Hardware',50),
  ('lss','Lock side Inside Smoke Seal damaged/Missing (Required to be Replaced)',45,'Seal',51),
  ('lsx','Lock side External Smoke Seal damaged/Missing (Required to be Replaced)',55,'Seal',52),
  ('mc','Missing Closer',165,'Hardware',53),
  ('mdh','Magnetic Door Holder reinspect / require removal',25,'Hardware',54),
  ('mep','Missing Escutcheon Plate',35,'Hardware',55),
  ('mewis','Missing EWIS Speaker $150.00+GST & ($85.00+GST per hour for Installation and testing EWIS Speaker)',150,'Alarm',56),
  ('mh','Missing Hinge (Weld New Hinge)',400,'Hinge',57),
  ('mhr','Hinge requires minor repair',75,'Hinge',58),
  ('msa','Missing Smoke Alarm $90.00+GST (add $85.00+GST/hr for electrician to hardwire)',NULL,'Alarm',59),
  ('n24','Faulty (No 240V Fault indicated)',NULL,'Alarm',60),
  ('na','No Access',NULL,'Access',61),
  ('ncbss','Non compliant perimeter seal, require removal / reinspection',25,'Seal',62),
  ('ncr','Non-Compliant Repair around lock (Require SS Plating & Fire Sealant)',250,'Lock',63),
  ('ncrx','Non-Compliant Repair around lock (Require Large Custom SS Plating & Fire Sealant)',60,'Lock',64),
  ('ndks','Non-compliant / Damaged Fire Door Knob Set',150,'Hardware',65),
  ('ndla','Non-Compliant Dead-Latch (Remove & replace with fire rated plate/plug & fire sealant)',90,'Lock',66),
  ('ndls','Non-compliant / Damaged Fire Door Lever Set',165,'Hardware',67),
  ('ndv','Non complaint door viewer or incorrectly installed, need to be replaced',50,'Hardware',68),
  ('nfbs','Non fire rated bottom seal has been installed — require to remove',35,'Seal',69),
  ('nfd','Fire Door Inconsistencies — Recheck Required',25,'Compliance',70),
  ('nfss','A non-fire rated smoke seal has been installed — require to remove',35,'Seal',71),
  ('nha','Need to Replace Heat Alarm',155,'Alarm',72),
  ('ni','No interconnection between the smoke alarms, require electrician to investigate',NULL,'Alarm',73),
  ('none','Not applicable — no need to inspect.',NULL,'Compliance',74),
  ('ns','No Sound Fault',NULL,'Alarm',75),
  ('nsa','Need to replace Smoke Alarm 240v',90,'Alarm',76),
  ('nsa9','Need to replace 9V Smoke Alarm',60,'Alarm',77),
  ('ntd','No compliance tag on the door',75,'Compliance',78),
  ('ntf','No compliance tag on the frame',75,'Compliance',79),
  ('obs','Obstructions in Common Area adj to entrance door',NULL,'Access',80),
  ('p','Passed',NULL,'General',81),
  ('pel','Non-Compliant Electronic Lock installed as primary lock',350,'Lock',82),
  ('ptd','The compliance tag is painted on door; requires to be paint stripped / reinspected',35,'Compliance',83),
  ('ptf','The compliance tag is painted on frame; requires to be paint stripped / reinspected',35,'Compliance',84),
  ('rb','Replaced Battery',10,'Alarm',85),
  ('rba','Replaced Battery (for annual compliance)',10,'Alarm',86),
  ('rc','Repair cables and/or terminals',35,'Alarm',87),
  ('rd','Rehang Door',75,'Hardware',88),
  ('rh','Remove Door, Rebate Hinge, Rehang',75,'Hinge',89),
  ('rha','Replaced Heat Alarm',155,'Alarm',90),
  ('ri','Require electrical investigation $85.00+GST p/hr',NULL,'Alarm',91),
  ('ros','Sprinkler head — removed minor obstruction',NULL,'General',92),
  ('rr','Re-inspection Required',NULL,'Compliance',93),
  ('rsa','Replaced Smoke Alarm',90,'Alarm',94),
  ('rsa9','Replaced 9V Smoke Alarm',60,'Alarm',95),
  ('rsb','Hanging off Ceiling (Reattached Smoke Alarm Base to Ceiling)',25,'Alarm',96),
  ('rtc','Require to Retension & Adjust Faulty Closer',25,'Hardware',97),
  ('rw','Re-wound hose during the inspection',25,'General',98),
  ('s12','Hardwired to Fire Panel',NULL,'Alarm',99),
  ('s24','240v Hardwired with 9V Battery back up',NULL,'Alarm',100),
  ('s24n','240v Hardwired with nonreplaceable battery backup',NULL,'Alarm',101),
  ('s9','Nonhardwired 9V Battery only',NULL,'Alarm',102),
  ('s9n','Nonhardwired nonreplaceable battery backup',NULL,'Alarm',103),
  ('sd','Security Device (remove & fill holes with Fire Sealant)',25,'Hardware',104),
  ('seq','Sequencer requires adjusting; if adjusting fails replace sequencer $195.00+GST',25,'Hardware',105),
  ('sh','Hardware requires servicing',25,'Hardware',106),
  ('sor','Sprinkler Obstruction Removed',NULL,'General',107),
  ('ted','Top Edge Delamination',215,'Delamination',108),
  ('tg','Top Gap',35,'Gap',109),
  ('tgt','Top Gap exceeding 3mm due to the door edge planed with a taper',NULL,'Gap',110),
  ('tgx','Top Gap 8mm+',75,'Gap',111),
  ('tl','Top Lock not latching correctly',NULL,'Lock',112),
  ('tsc','Top Side Contact',25,'Hardware',113),
  ('tss','Top Inside Smoke Seal damaged/Missing (Required to be Replaced)',25,'Seal',114),
  ('tsx','Top External Smoke Seal damaged/Missing (Required to be Replaced)',40,'Seal',115),
  ('wa','Didn''t go into emergency mode during the test; require electrician to investigate $85.00+GSTp/h',NULL,'Alarm',116),
  ('warp','The Fire Door is warped out of shape and is not latching correctly',150,'Hardware',117),
  ('wl1','1 window lock — missing/damaged',35,'Window',118),
  ('wl2','2 window locks — missing/damaged',65,'Window',119),
  ('wl3','3 window locks — missing/damaged',90,'Window',120),
  ('wl4','4 window locks — missing/damaged',115,'Window',121),
  ('wl5','5 window locks — missing/damaged',140,'Window',122),
  ('wr','Welding Required & may require Fire Detection Isolations $250.00+GST',400,'Hardware',123)
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- VERIFY
-- ────────────────────────────────────────────────────────────
SELECT 'asset_type_definitions' AS tbl, COUNT(*) FROM public.asset_type_definitions
UNION ALL
SELECT 'defect_codes', COUNT(*) FROM public.defect_codes
UNION ALL
SELECT 'inventory_items', COUNT(*) FROM public.inventory_items;

-- ────────────────────────────────────────────────────────────
-- SEED: inventory_items
-- Common fire-safety service/repair catalogue items.
-- Run this block if the above shows 0 inventory_items.
-- ────────────────────────────────────────────────────────────

INSERT INTO public.inventory_items (id, name, description, price)
VALUES
  (gen_random_uuid(),'Smoke Alarm Replacement (240V)','Supply & install hardwired 240V smoke alarm',90.00),
  (gen_random_uuid(),'Smoke Alarm Replacement (9V)','Supply & install 9V battery smoke alarm',60.00),
  (gen_random_uuid(),'Heat Alarm Replacement','Supply & install heat alarm unit',155.00),
  (gen_random_uuid(),'Battery Replacement','Replace alarm battery (compliance)',10.00),
  (gen_random_uuid(),'Fire Door Closer Replacement','Supply & install hydraulic door closer',165.00),
  (gen_random_uuid(),'Door Closer Service','Retension & adjust faulty door closer',25.00),
  (gen_random_uuid(),'Smoke Seal Replacement','Supply & install smoke seal (per side)',45.00),
  (gen_random_uuid(),'Hinge Repair (Minor)','Minor hinge repair / re-tighten',75.00),
  (gen_random_uuid(),'Door Rehang','Remove and rehang misaligned fire door',75.00),
  (gen_random_uuid(),'Window Lock Replacement','Supply & install window lock (per lock)',35.00),
  (gen_random_uuid(),'Compliance Tag (Door)','Supply & install new fire door compliance tag',75.00),
  (gen_random_uuid(),'Fire Sealant / Putty Repair','Fire rated sealant for holes in door or frame',25.00),
  (gen_random_uuid(),'SS Plating (Lock Area)','Stainless steel plating around non-compliant lock',250.00),
  (gen_random_uuid(),'DCP Extinguisher Service (4.5KG)','6-yr service — DCP AB(E) 4.5KG',145.00),
  (gen_random_uuid(),'CO2 Extinguisher Service (2.0KG)','6-yr service — CO2 2.0KG',185.00),
  (gen_random_uuid(),'Fire Hose Reel Service','Annual service of fire hose reel',95.00),
  (gen_random_uuid(),'Emergency Light Test & Replace','Test and replace emergency luminaire',85.00),
  (gen_random_uuid(),'Exit Sign Replacement','Supply & install replacement exit sign',120.00),
  (gen_random_uuid(),'Electrical Investigation (per hr)','Electrician investigation — $85/hr',85.00),
  (gen_random_uuid(),'Re-inspection Fee','Return visit for reinspection after defect rectification',75.00)
ON CONFLICT DO NOTHING;
```

*Size: **406** lines of code.*

---

## 📄 `supabase/migrations/fix_photo_delete_rls.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- ============================================================
-- UMA BUILDING SERVICES — Fix: Missing DELETE RLS on inspection_photos
-- ============================================================
-- ROOT CAUSE: The inspection_photos table had SELECT and INSERT
-- policies but NO DELETE policy.  Supabase silently blocked every
-- delete from the mobile app, causing the sync retry counter to
-- exhaust after 5 attempts.  After that, the photo stayed in
-- Supabase forever and reappeared on every reinstall / pull.
--
-- Run this ONCE in your Supabase → SQL Editor.
-- ============================================================

-- 1. Add the missing DELETE policy ──────────────────────────
--    Allows the technician to delete photos for jobs assigned to them.
CREATE POLICY "photos_delete_via_job" ON public.inspection_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND j.assigned_to = auth.uid()
    )
  );


-- 2. Add defect_id column if not present (Migration 7) ─────
--    Safe to run — ALTER TABLE ADD COLUMN is idempotent with the catch below.
DO $$
BEGIN
  ALTER TABLE public.inspection_photos ADD COLUMN defect_id UUID
    REFERENCES public.defects(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;


-- 3. Verify the policy was created ──────────────────────────
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'inspection_photos'
ORDER BY policyname;
```

*Size: **41** lines of code.*

---

## 📄 `supabase/migrations/fix_reports_storage.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- 1. Create the 'job-reports' bucket and make it public (if not already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-reports', 'job-reports', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to upload files to this bucket
CREATE POLICY "Authenticated users can upload reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'job-reports' );

-- 3. Allow anyone to view the reports (Required for URLs to load)
CREATE POLICY "Anyone can view reports"
ON storage.objects FOR SELECT
USING ( bucket_id = 'job-reports' );

-- 4. Allow users to update (or overwrite) files
CREATE POLICY "Authenticated users can update reports"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'job-reports' );

-- 5. Allow users to delete files (useful for cleanup)
CREATE POLICY "Authenticated users can delete reports"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'job-reports' );
```

*Size: **28** lines of code.*

---

## 📄 `supabase/migrations/multi_tenant_catalogue_patch.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- ============================================================
-- AIRTIGHT MULTI-TENANT ISOLATION PATCH FOR CATALOGUE
-- ============================================================
-- Run this in your Supabase SQL Editor.
-- It adds company_id to the catalogue tables (asset_type_definitions, 
-- defect_codes, inventory_items) so each tenant has their own catalogue.

-- 1. Create inventory_items table if it was missed previously
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  price       NUMERIC     NOT NULL DEFAULT 0.0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id)
);

-- 2. Add company_id columns
ALTER TABLE public.asset_type_definitions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.defect_codes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- 3. Enable RLS
ALTER TABLE public.asset_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- 4. Create airtight policies
DROP POLICY IF EXISTS "asset_types_tenant_isolation" ON public.asset_type_definitions;
CREATE POLICY "asset_types_tenant_isolation" ON public.asset_type_definitions 
  FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "defect_codes_tenant_isolation" ON public.defect_codes;
CREATE POLICY "defect_codes_tenant_isolation" ON public.defect_codes 
  FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "inventory_tenant_isolation" ON public.inventory_items;
CREATE POLICY "inventory_tenant_isolation" ON public.inventory_items 
  FOR ALL USING (company_id = public.get_user_company_id());

-- Note: Because we added company_id to these tables, the old seeded data 
-- (which has company_id = NULL) will be invisible to all companies. 
-- In a real multi-tenant system, you should seed default catalogue items 
-- for a company whenever a new company is created!
```

*Size: **45** lines of code.*

---

## 📄 `supabase/migrations/multi_tenant_catalogue_upgrade.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- ============================================================
-- MULTI-TENANT CATALOGUE UPGRADE SCRIPT
-- ============================================================
-- Run this script directly in your Supabase SQL Editor.
-- 
-- What this does:
-- 1. Adds company_id to catalogue tables
-- 2. Makes Unique constraints company-specific (so different companies can have a defect code called "GEN-01")
-- 3. Creates an auto-cloning trigger for new companies
-- 4. Clones the global templates for all currently existing companies
-- 5. Enables strict RLS so companies only see their own private clones

-- 1. Ensure inventory_items table exists
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  price       NUMERIC     NOT NULL DEFAULT 0.0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id)
);

-- 2. Add company_id columns
ALTER TABLE public.asset_type_definitions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.defect_codes           ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_items        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. Update Unique Constraints to be Company-Specific
-- First drop the global unique constraints
ALTER TABLE public.asset_type_definitions DROP CONSTRAINT IF EXISTS asset_type_definitions_value_key;
ALTER TABLE public.defect_codes           DROP CONSTRAINT IF EXISTS defect_codes_code_key;

-- Add scoped unique constraints (Company A and Company B can both have value="extinguisher")
ALTER TABLE public.asset_type_definitions ADD CONSTRAINT asset_type_definitions_company_value_key UNIQUE NULLS NOT DISTINCT (company_id, value);
ALTER TABLE public.defect_codes           ADD CONSTRAINT defect_codes_company_code_key UNIQUE NULLS NOT DISTINCT (company_id, code);


-- 4. Create the cloning logic function
CREATE OR REPLACE FUNCTION public.clone_catalogue_for_company(new_company_id UUID)
RETURNS void AS $$
BEGIN
  -- Clone Asset Types
  INSERT INTO public.asset_type_definitions (
    company_id, value, label, full_label, icon, color, inspection_routine, variants, is_active, sort_order
  )
  SELECT 
    new_company_id, value, label, full_label, icon, color, inspection_routine, variants, is_active, sort_order
  FROM public.asset_type_definitions
  WHERE company_id IS NULL
  ON CONFLICT DO NOTHING;

  -- Clone Defect Codes
  INSERT INTO public.defect_codes (
    company_id, code, description, quote_price, category, is_active, sort_order
  )
  SELECT 
    new_company_id, code, description, quote_price, category, is_active, sort_order
  FROM public.defect_codes
  WHERE company_id IS NULL
  ON CONFLICT DO NOTHING;
  
  -- Clone Inventory Items
  INSERT INTO public.inventory_items (
    company_id, name, description, price
  )
  SELECT 
    new_company_id, name, description, price
  FROM public.inventory_items
  WHERE company_id IS NULL
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Create Trigger for future companies
CREATE OR REPLACE FUNCTION public.on_company_created_catalogue()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.clone_catalogue_for_company(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_clone_catalogue ON public.companies;
CREATE TRIGGER trigger_clone_catalogue
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.on_company_created_catalogue();


-- 6. Execute cloning immediately for all CURRENT companies
DO $$
DECLARE
  comp RECORD;
BEGIN
  FOR comp IN SELECT id FROM public.companies LOOP
    PERFORM public.clone_catalogue_for_company(comp.id);
  END LOOP;
END;
$$;


-- 7. Apply Strict Row Level Security (RLS)
ALTER TABLE public.asset_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_codes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_types_tenant_isolation" ON public.asset_type_definitions;
CREATE POLICY "asset_types_tenant_isolation" ON public.asset_type_definitions 
  FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "defect_codes_tenant_isolation" ON public.defect_codes;
CREATE POLICY "defect_codes_tenant_isolation" ON public.defect_codes 
  FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "inventory_tenant_isolation" ON public.inventory_items;
CREATE POLICY "inventory_tenant_isolation" ON public.inventory_items 
  FOR ALL USING (company_id = public.get_user_company_id());

-- ============================================================
-- DONE! The platform is now fully multi-tenant for catalogues.
-- ============================================================
```

*Size: **122** lines of code.*

---

## 📄 `supabase/migrations/schema.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- ============================================================
-- SITETRACK SAAS — Canonical Supabase Schema
-- ============================================================
-- This is the AUTHORITATIVE multi-tenant schema.
-- It includes all table definitions, airtight Row Level Security 
-- (RLS) policies, storage buckets, and triggers.
--
-- HOW TO USE:
--   Fresh project → run this file ONCE in SQL Editor.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONS & FUNCTIONS
-- ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Airtight lookup function for RLS
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- TABLE DEFINITIONS
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abn text,
  subscription_status text NOT NULL DEFAULT 'active'::text CHECK (subscription_status = ANY (ARRAY['active'::text, 'suspended'::text, 'cancelled'::text])),
  address text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  contact_email text,
  logo_url text,
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);

CREATE TABLE public.users (
  id uuid NOT NULL,
  company_id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'technician'::text CHECK (role = ANY (ARRAY['technician'::text, 'subcontractor'::text, 'admin'::text])),
  phone text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  push_token text,
  accepted_tos_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.properties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  suburb text,
  state text,
  postcode text,
  site_contact_name text,
  site_contact_phone text,
  access_notes text,
  hazard_notes text,
  site_note text,
  compliance_status text NOT NULL DEFAULT 'pending'::text CHECK (compliance_status = ANY (ARRAY['compliant'::text, 'non_compliant'::text, 'overdue'::text, 'pending'::text])),
  next_inspection_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT properties_pkey PRIMARY KEY (id),
  CONSTRAINT properties_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  property_id uuid NOT NULL,
  asset_type text NOT NULL,
  variant text,
  asset_ref text,
  description text,
  location_on_site text,
  serial_number text,
  barcode_id text,
  install_date date,
  last_service_date date,
  next_service_date date,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'decommissioned'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT assets_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id)
);

CREATE TABLE public.jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  property_id uuid NOT NULL,
  assigned_to uuid NOT NULL,
  job_type text NOT NULL CHECK (job_type = ANY (ARRAY['routine_service'::text, 'defect_repair'::text, 'installation'::text, 'emergency'::text, 'quote'::text])),
  status text NOT NULL DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  scheduled_date date NOT NULL,
  scheduled_time time without time zone,
  priority text NOT NULL DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  notes text,
  report_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT jobs_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id),
  CONSTRAINT jobs_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id)
);

CREATE TABLE public.job_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  result text CHECK (result = ANY (ARRAY['pass'::text, 'fail'::text, 'not_tested'::text])),
  is_compliant boolean NOT NULL DEFAULT false,
  defect_reason text,
  technician_notes text,
  checklist_data jsonb,
  actioned_at timestamp with time zone,
  CONSTRAINT job_assets_pkey PRIMARY KEY (id),
  CONSTRAINT job_assets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT job_assets_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);

CREATE TABLE public.defects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  property_id uuid NOT NULL,
  description text NOT NULL,
  severity text NOT NULL CHECK (severity = ANY (ARRAY['minor'::text, 'major'::text, 'critical'::text])),
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'quoted'::text, 'repaired'::text, 'monitoring'::text])),
  defect_code text,
  quote_price numeric,
  photos ARRAY NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT defects_pkey PRIMARY KEY (id),
  CONSTRAINT defects_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT defects_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT defects_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id),
  CONSTRAINT defects_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id)
);

CREATE TABLE public.inspection_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL,
  asset_id uuid,
  defect_id uuid,
  photo_url text NOT NULL,
  caption text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  uploaded_by uuid NOT NULL,
  CONSTRAINT inspection_photos_pkey PRIMARY KEY (id),
  CONSTRAINT inspection_photos_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT inspection_photos_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT inspection_photos_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id),
  CONSTRAINT inspection_photos_defect_id_fkey FOREIGN KEY (defect_id) REFERENCES public.defects(id),
  CONSTRAINT inspection_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);

CREATE TABLE public.signatures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL UNIQUE,
  signature_url text NOT NULL,
  signed_by_name text NOT NULL,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT signatures_pkey PRIMARY KEY (id),
  CONSTRAINT signatures_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT signatures_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);

CREATE TABLE public.time_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  clock_in timestamp with time zone NOT NULL,
  clock_out timestamp with time zone,
  gps_lat numeric,
  gps_lng numeric,
  travel_time_minutes integer,
  CONSTRAINT time_logs_pkey PRIMARY KEY (id),
  CONSTRAINT time_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT time_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT time_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.asset_type_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  full_label text NOT NULL,
  icon text NOT NULL DEFAULT 'shield-check-outline'::text,
  color text NOT NULL DEFAULT '#6B7280'::text,
  inspection_routine text NOT NULL DEFAULT 'General Inspection'::text,
  variants ARRAY NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  CONSTRAINT asset_type_definitions_pkey PRIMARY KEY (id),
  CONSTRAINT asset_type_definitions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.defect_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  quote_price numeric,
  category text NOT NULL DEFAULT 'General'::text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  CONSTRAINT defect_codes_pkey PRIMARY KEY (id),
  CONSTRAINT defect_codes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.enquiries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  service text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new'::text CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'converted'::text, 'closed'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT enquiries_pkey PRIMARY KEY (id),
  CONSTRAINT enquiries_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  type text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.super_admins (
  id uuid NOT NULL,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT super_admins_pkey PRIMARY KEY (id),
  CONSTRAINT super_admins_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.platform_settings (
  id text NOT NULL DEFAULT 'global'::text,
  platform_name text NOT NULL DEFAULT 'SiteTrack'::text,
  support_email text NOT NULL DEFAULT 'support@sitetrack.io'::text,
  website_url text NOT NULL DEFAULT 'https://sitetrack.io'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0.0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- ────────────────────────────────────────────────────────────
-- TRIGGERS
-- ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS companies_updated_at ON public.companies;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS properties_updated_at ON public.properties;
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS jobs_updated_at ON public.jobs;
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS asset_type_definitions_updated_at ON public.asset_type_definitions;
CREATE TRIGGER asset_type_definitions_updated_at BEFORE UPDATE ON public.asset_type_definitions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS defect_codes_updated_at ON public.defect_codes;
CREATE TRIGGER defect_codes_updated_at BEFORE UPDATE ON public.defect_codes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS enquiries_updated_at ON public.enquiries;
CREATE TRIGGER enquiries_updated_at BEFORE UPDATE ON public.enquiries FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- AIRTIGHT ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- 1. Companies (Select own company)
DROP POLICY IF EXISTS "companies_tenant_isolation" ON public.companies;
CREATE POLICY "companies_tenant_isolation" ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

-- 2. General Tenant Isolation Policies
DROP POLICY IF EXISTS "users_tenant_isolation" ON public.users;
CREATE POLICY "users_tenant_isolation" ON public.users FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "properties_tenant_isolation" ON public.properties;
CREATE POLICY "properties_tenant_isolation" ON public.properties FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "assets_tenant_isolation" ON public.assets;
CREATE POLICY "assets_tenant_isolation" ON public.assets FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "jobs_tenant_isolation" ON public.jobs;
CREATE POLICY "jobs_tenant_isolation" ON public.jobs FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "job_assets_tenant_isolation" ON public.job_assets;
CREATE POLICY "job_assets_tenant_isolation" ON public.job_assets FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "defects_tenant_isolation" ON public.defects;
CREATE POLICY "defects_tenant_isolation" ON public.defects FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "photos_tenant_isolation" ON public.inspection_photos;
CREATE POLICY "photos_tenant_isolation" ON public.inspection_photos FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "signatures_tenant_isolation" ON public.signatures;
CREATE POLICY "signatures_tenant_isolation" ON public.signatures FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "time_logs_tenant_isolation" ON public.time_logs;
CREATE POLICY "time_logs_tenant_isolation" ON public.time_logs FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "asset_types_tenant_isolation" ON public.asset_type_definitions;
CREATE POLICY "asset_types_tenant_isolation" ON public.asset_type_definitions FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "defect_codes_tenant_isolation" ON public.defect_codes;
CREATE POLICY "defect_codes_tenant_isolation" ON public.defect_codes FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "inventory_tenant_isolation" ON public.inventory_items;
CREATE POLICY "inventory_tenant_isolation" ON public.inventory_items FOR ALL USING (company_id = public.get_user_company_id());

-- 3. Storage Buckets (Job Photos)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('job-photos', 'job-photos', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "tenant_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_delete" ON storage.objects;

CREATE POLICY "tenant_photos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'job-photos' AND 
    auth.uid() IN (SELECT id FROM public.users WHERE company_id = public.get_user_company_id())
  );

CREATE POLICY "tenant_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-photos' AND 
    auth.uid() IN (SELECT id FROM public.users WHERE company_id = public.get_user_company_id())
  );

CREATE POLICY "tenant_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'job-photos' AND 
    auth.uid() IN (SELECT id FROM public.users WHERE company_id = public.get_user_company_id())
  );
```

*Size: **412** lines of code.*

---

## 📄 `supabase/migrations/settings_patch.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- Adds JSONB settings columns to the companies table
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"new_job": true, "critical_defect": true, "quote_submitted": true, "job_completed": false, "overdue_service": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS compliance_standards JSONB DEFAULT '{"as1851": true, "as2293": true, "as1670": false, "bca": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS appearance_settings JSONB DEFAULT '{"theme": "Light", "primary_color": "#1B2D4F"}'::jsonb;
```

*Size: **6** lines of code.*

---

## 📄 `supabase/migrations/sitetrack_audit_extend.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- Attach triggers to core operational tables

-- 1. properties
DROP TRIGGER IF EXISTS audit_properties_trigger ON public.properties;
CREATE TRIGGER audit_properties_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 2. assets
DROP TRIGGER IF EXISTS audit_assets_trigger ON public.assets;
CREATE TRIGGER audit_assets_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 3. jobs
DROP TRIGGER IF EXISTS audit_jobs_trigger ON public.jobs;
CREATE TRIGGER audit_jobs_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 4. job_assets (Inspection Pass/Fail Results)
DROP TRIGGER IF EXISTS audit_job_assets_trigger ON public.job_assets;
CREATE TRIGGER audit_job_assets_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.job_assets
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 5. defects
DROP TRIGGER IF EXISTS audit_defects_trigger ON public.defects;
CREATE TRIGGER audit_defects_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.defects
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 6. quotes
DROP TRIGGER IF EXISTS audit_quotes_trigger ON public.quotes;
CREATE TRIGGER audit_quotes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Notify PostgREST to reload the schema
NOTIFY pgrst, 'reload schema';
```

*Size: **41** lines of code.*

---

## 📄 `supabase/migrations/sitetrack_audit_patch.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- Add legal consent tracking columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS accepted_tos_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS accepted_aup_at TIMESTAMP WITH TIME ZONE;

-- Create the audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster queries on specific records (e.g. tracking history of one technician or one fire asset)
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);

-- Create the generic trigger function
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Try to get the user ID from Supabase auth context
    current_user_id := auth.uid();
    
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb, current_user_id);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, current_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::jsonb, current_user_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to core tables
DROP TRIGGER IF EXISTS audit_users_trigger ON public.users;
CREATE TRIGGER audit_users_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_companies_trigger ON public.companies;
CREATE TRIGGER audit_companies_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Apply it to other critical tables (uncomment if they exist)
-- DROP TRIGGER IF EXISTS audit_properties_trigger ON public.properties;
-- CREATE TRIGGER audit_properties_trigger
-- AFTER INSERT OR UPDATE OR DELETE ON public.properties
-- FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Notify PostgREST to reload the schema so the API immediately sees the new columns
NOTIFY pgrst, 'reload schema';
```

*Size: **67** lines of code.*

---

## 📄 `supabase/migrations/sitetrack_dynamic_sidebar.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- 1. Add Dynamic Sidebar Link fields to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS custom_sidebar_label text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS custom_sidebar_url text;

-- 2. Ensure enquiries table allows Tenant Admins to read their own leads
-- First check if RLS is enabled on enquiries
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

-- Create policy for Tenant Admins to see their own enquiries (company_id matches)
-- Using the standard SiteTrack auth pattern (auth.uid() is matched against user's company_id)
DROP POLICY IF EXISTS "Tenant Admins can view their own company enquiries" ON enquiries;

CREATE POLICY "Tenant Admins can view their own company enquiries"
ON enquiries
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);
```

*Size: **22** lines of code.*

---

## 📄 `supabase/migrations/SUPABASE_ASSETS_DEFECTS.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- ============================================================
-- UMA BUILDING SERVICES — Catalogue Migration
-- Run this ONCE in the Supabase SQL editor.
-- Creates asset_type_definitions + defect_codes tables and
-- seeds them with all data currently in the TypeScript constants.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLE: asset_type_definitions
-- Admin-managed catalogue of fire-safety asset types.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_type_definitions (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  value               TEXT        NOT NULL UNIQUE,
  label               TEXT        NOT NULL,
  full_label          TEXT        NOT NULL,
  icon                TEXT        NOT NULL DEFAULT 'shield-check-outline',
  color               TEXT        NOT NULL DEFAULT '#6B7280',
  inspection_routine  TEXT        NOT NULL DEFAULT 'General Inspection (Annual)',
  variants            TEXT[]      NOT NULL DEFAULT '{}',
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT asset_type_definitions_pkey PRIMARY KEY (id)
);

ALTER TABLE public.asset_type_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_types_select_auth" ON public.asset_type_definitions;
CREATE POLICY "asset_types_select_auth" ON public.asset_type_definitions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- TABLE: defect_codes
-- Admin-managed library of defect codes and reference prices.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.defect_codes (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  description TEXT        NOT NULL,
  quote_price NUMERIC,
  category    TEXT        NOT NULL DEFAULT 'General',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT defect_codes_pkey PRIMARY KEY (id)
);

ALTER TABLE public.defect_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "defect_codes_select_auth" ON public.defect_codes;
CREATE POLICY "defect_codes_select_auth" ON public.defect_codes
  FOR SELECT USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- SEED: asset_type_definitions
-- ────────────────────────────────────────────────────────────

INSERT INTO public.asset_type_definitions (value, label, full_label, icon, color, inspection_routine, variants, sort_order)
VALUES
  (
    'BGA, MCP or Manual Call Point',
    'MCP / Call Point',
    'BGA, MCP or Manual Call Point',
    'alarm-light',
    '#7C3AED',
    'Access Control System (Annual)',
    ARRAY['Break Glass'],
    1
  ),
  (
    'Emergency - Exit Signs',
    'Exit Signs',
    'Emergency - Exit Signs',
    'exit-run',
    '#059669',
    '15 - Emergency escape lighting and exit signs (Annual)',
    ARRAY[
      'Blade (Ceiling Mount) - Exit','Blade (Recessed) - Exit','Box (Wall Mount) - Exit',
      'Exit Sign (Non-Illuminated)','Exit Sign (Thin Blade)','Exit Sign Gear Tray',
      'Exit Sign Weather Proof','Exit Sign Wide Body','Jumbo (Ceiling Mount) - Exit',
      'Jumbo (Wall Mount) - Exit','Pyramid (Ceiling Mount) - Exit',
      'Quick Fit (Ceiling Mount geartray) - Exit','Quick Fit (Ceiling Mount) - Exit',
      'Quick Fit (Wall Mount) - Exit','Weatherproof (Ceiling Mount) - Exit',
      'Weatherproof (Wall Mount) - Exit'
    ],
    2
  ),
  (
    'Emergency - Lighting',
    'Emergency Lighting',
    'Emergency - Lighting',
    'lightning-bolt',
    '#F59E0B',
    '15 - Emergency escape lighting and exit signs (Annual)',
    ARRAY[
      '1FT - Geartray Diffused','2FT - Single Bare Batten','2FT - Single Diffused Batten',
      '2FT - Single Weatherproof Batten','2FT - Single Wireguard Batten','2FT - Twin Bare Batten',
      '2FT - Twin Diffused Batten','2FT - Twin Weatherproof Batten','2FT - Twin Wireguard Batten',
      '4FT - Single Bare Batten','4FT - Single Diffused Batten','4FT - Single Weatherproof Batten',
      '4FT - Single Wireguard Batten','4FT - Twin Bare Batten','4FT - Twin Diffused Batten',
      '4FT - Twin Weatherproof Batten','4FT - Twin Wireguard Batten','Box Ceiling/Wall',
      'Circuit Breaker','Flood Twin','Flood Twin Weatherproof','Main Switch Board',
      'Oyster','Oyster (Weatherproof)','Panel LED T-Bar','Spitfire (Flush Mount)',
      'Spitfire - (Surface Mount)','Square Ceiling/Wall - Light','Test Switch'
    ],
    3
  ),
  (
    'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)',
    'Fire Detection',
    'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)',
    'smoke-detector',
    '#DC2626',
    '06 - Fire Detection (Devices) (Annual)',
    ARRAY[
      'ASE (Alarm Monitoring)','Beam Detector','Bell','Detector - Co2',
      'Detector - Concealed Heat','Detector - Concealed Smoke','Detector - Flame',
      'Detector - Heat','Detector - Smoke','Duct probe','Emergency Door Release',
      'Fail Safe Device','Flow Switch','Horn (Single)','Horn (Twin)',
      'MCP (Indoor)','MCP (Weatherproof)','Pressure Switch','Sounder','Strobe','Vesda'
    ],
    4
  ),
  (
    'Fire Door (CA)',
    'Fire Door',
    'Fire Door (CA)',
    'door',
    '#8B5CF6',
    '12 - Passive Fire (Hinged and Pivoted Doorsets - Common) (Annual)',
    ARRAY[
      'Automatic Door','Exit Door - Double Even pair','Exit Door - Double Uneven pair',
      'Exit Door - Single','Fire Door - Double Even pair','Fire Door - Double Uneven pair',
      'Fire Door - Single','Fire Door - Single Double Action','Fire Safety Door',
      'Smoke & Fire Door - Single','Smoke Door - Double Even Pair','Smoke Door - Double Uneven pair',
      'Smoke Door - Single','Smoke Door - Single Double Action','Smoke Door - Uneven Pair',
      'Solid Core Doorset - Double','Solid Core Doorset - Single'
    ],
    5
  ),
  (
    'Fire Extinguishers - Portable',
    'Fire Extinguisher',
    'Fire Extinguishers - Portable',
    'fire-extinguisher',
    '#EF4444',
    '10 - Portable and Wheeled Fire Extinguishers (Annual)',
    ARRAY[
      'Air/Water 9.0LT','CO2 2.0KG','CO2 3.5KG','CO2 5.0KG',
      'DCP AB(E) 1.0KG','DCP AB(E) 1.5KG','DCP AB(E) 2.0KG','DCP AB(E) 2.3KG',
      'DCP AB(E) 2.5KG','DCP AB(E) 4.5KG','DCP AB(E) 6.0KG','DCP AB(E) 9.0KG',
      'DCP B(E) 2.3KG','DCP B(E) 4.5KG','DCP B(E) 9.0KG','Foam AFFF 9.0LT',
      'Foam F3 (Fluorine Free) 9.0LT','Wet Chemical 2.0Lt','Wet Chemical 7.0Lt'
    ],
    6
  ),
  (
    'Fire Hose Reels',
    'Hose Reels',
    'Fire Hose Reels',
    'pipe',
    '#0891B2',
    '09 - Fire Hose Reels (Annual)',
    ARRAY[
      '100m - 19mm - Fire','100m - 25mm - Fire','36m - 19mm - Green Wash Down',
      '36m - 19mm - Fire','36m - 25mm - Fire','50m - 19mm - Fire',
      '50m - 25mm - Fire','Fire Hose Reel Flow Test'
    ],
    7
  ),
  (
    'Fire Hydrant System',
    'Fire Hydrant',
    'Fire Hydrant System',
    'pipe-valve',
    '#B91C1C',
    '04 - Fire Hydrant Systems (Annual - Valves)',
    ARRAY[
      '20Lt Foam pail','Booster - Hydrant','Booster - Sprinkler',
      'Hydrant System Flow test','Hydrant landing valves',
      'In-ground Spring Hydrant','Pillar Landing Valve','Sprinkler head'
    ],
    8
  ),
  (
    'Fire Sprinkler System - Wet Pipe',
    'Sprinkler System',
    'Fire Sprinkler System - Wet Pipe',
    'water',
    '#2563EB',
    '02 - Automatic Fire Sprinkler Systems (Annual Flow)',
    ARRAY[
      'Foam Water Systems','General System','Sprinkler Alarm Valve',
      'Sprinkler System Flow Test','Sprinkler Valve','Sprinkler head',
      'Wall Wetting System','Window Wetter System','sprinkler (heads) cabinet'
    ],
    9
  )
ON CONFLICT (value) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SEED: defect_codes
-- ────────────────────────────────────────────────────────────

INSERT INTO public.defect_codes (code, description, quote_price, category, sort_order)
VALUES
  ('anf','Alarm not indicated on FIP — require investigation $85/hr',NULL,'Alarm',1),
  ('bb','Broken Button exposing Circuit Board',NULL,'Hardware',2),
  ('bed','Bottom Edge Delamination',250,'Delamination',3),
  ('bg','Bottom Gap (10–15mm) — Confirm the gap size; if >10mm then install fire rated seal at additional $135.00+GST',NULL,'Gap',4),
  ('bgx','Bottom Gap (15–25mm)',250,'Gap',5),
  ('bosa','Battery Only Smoke Alarm (Require to be 240V Smoke Alarm)',NULL,'Alarm',6),
  ('brk','BRK 10yrs+ Expired',NULL,'Alarm',7),
  ('bsc','Bottom Side Contact',75,'Hardware',8),
  ('bss','Bottom Smoke Seal requires adjusting; if adjustment fails then replace Seal $135.00',25,'Seal',9),
  ('bsx','Bottom Smoke Seal External requires adjusting; if adjustment fails then replace Seal $125.00',25,'Seal',10),
  ('cdla','Cut out in Fire Door for dead latch installation & non-compliant wrong type of deadlatch door strike installed',295,'Lock',11),
  ('Covid','No access due to sickness or self-isolating or covid restrictions. Require Re-inspection with no extra cost.',NULL,'Access',12),
  ('cs','Constant Sounding Fault',NULL,'Alarm',13),
  ('da','Closer detached arm — service hardware',25,'Hardware',14),
  ('db','Non-Compliant Dead-Bolt (Remove & replace with SS Plating & Fire Sealant)',95,'Lock',15),
  ('dc','Damaged Closer',165,'Hardware',16),
  ('dde','Damage on the door edge (SS Plating & Fire Sealant)',250,'Delamination',17),
  ('ddex','Large Damage on the door edge (SS Custom Plating & Fire Sealant)',350,'Delamination',18),
  ('df','Damaged/tampered physically, failed',NULL,'General',19),
  ('dh','Damaged Hinge — attempt a minor repair (if welding required $400.00+GST & fire detection Isolations $250.00+GST)',75,'Hinge',20),
  ('dl','Non-Compliant Dead-Lock (Remove & replace with SS Plating & Fire Sealant)',90,'Lock',21),
  ('dla','Non-Compliant Dead-Latch (Remove & replace with SS Plating & Fire Sealant)',90,'Lock',22),
  ('ds','Door Strike in Frame damaged/modified (Welding Required & may require Fire Detection Isolations $250.00+GST)',400,'Hardware',23),
  ('el','Non-Compliant Electronic Lock (Remove & replace with Compliant Dead-Latch with a scar plate, fire sealant and or SS filler plate)',325,'Lock',24),
  ('ep','Escutcheon ring(s) & base(s) — missing/corroded — require replacing',195,'Hardware',25),
  ('ewls','EWIS speaker(s) low sound — require investigation $85.00+GST/hr & may require replacing $150.00+GST ea',NULL,'Alarm',26),
  ('ewns','EWIS speaker(s) no sound — require investigation $85.00+GST/hr & may require replacing $150.00+GST ea',NULL,'Alarm',27),
  ('exp','Exceed 10yr service Life',NULL,'Compliance',28),
  ('f','Fail',NULL,'General',29),
  ('fc','Faulty Closer Leaking Hydraulic Oil',165,'Hardware',30),
  ('fnf','Fault not indicated on FIP — require investigation $85/hr',NULL,'Alarm',31),
  ('fs','Non fire rated foam seal — require to remove',50,'Seal',32),
  ('h','Hole(s) in Door or Frame, Require Fire Rated Putty/Sealant.',25,'General',33),
  ('hd','The closer is warped out and too weak to close the door. It requires to be replaced with the heavy duty closer.',175,'Hardware',34),
  ('hed','Hinge Edge Delamination',250,'Delamination',35),
  ('hg','Hinge Gap',75,'Gap',36),
  ('hg5','Hinge Gap half Length',35,'Gap',37),
  ('hgt','Hinge Gap exceeding 3mm due to the door edge planed with a taper',NULL,'Gap',38),
  ('hgx','Hinge Gap 8mm+ (Recheck gap size)',75,'Gap',39),
  ('hss','Hinge Inside Smoke Seal damaged/Missing (Required to be Replaced)',45,'Seal',40),
  ('hsx','Hinge External Smoke Seal damaged/Missing (Required to be Replaced)',55,'Seal',41),
  ('ip','Suspected non-approved partition(s) or subdivision(s) found',NULL,'Compliance',42),
  ('led','Lock Edge Delamination',215,'Delamination',43),
  ('lg','Lock side Gap',75,'Gap',44),
  ('lg5','Lock side Gap half Length',35,'Gap',45),
  ('lgt','Lock Side Gap exceeding 3mm due to the door edge planed with a taper',NULL,'Gap',46),
  ('lgx','Lock side Gap 8mm+',75,'Gap',47),
  ('lp','Latch Plate (Damaged/Missing)',20,'Hardware',48),
  ('ls','Low Sound Fault',NULL,'Alarm',49),
  ('lsc','Lock Side Contact, require to rehang door',75,'Hardware',50),
  ('lss','Lock side Inside Smoke Seal damaged/Missing (Required to be Replaced)',45,'Seal',51),
  ('lsx','Lock side External Smoke Seal damaged/Missing (Required to be Replaced)',55,'Seal',52),
  ('mc','Missing Closer',165,'Hardware',53),
  ('mdh','Magnetic Door Holder reinspect / require removal',25,'Hardware',54),
  ('mep','Missing Escutcheon Plate',35,'Hardware',55),
  ('mewis','Missing EWIS Speaker $150.00+GST & ($85.00+GST per hour for Installation and testing EWIS Speaker)',150,'Alarm',56),
  ('mh','Missing Hinge (Weld New Hinge)',400,'Hinge',57),
  ('mhr','Hinge requires minor repair',75,'Hinge',58),
  ('msa','Missing Smoke Alarm $90.00+GST (add $85.00+GST/hr for electrician to hardwire)',NULL,'Alarm',59),
  ('n24','Faulty (No 240V Fault indicated)',NULL,'Alarm',60),
  ('na','No Access',NULL,'Access',61),
  ('ncbss','Non compliant perimeter seal, require removal / reinspection',25,'Seal',62),
  ('ncr','Non-Compliant Repair around lock (Require SS Plating & Fire Sealant)',250,'Lock',63),
  ('ncrx','Non-Compliant Repair around lock (Require Large Custom SS Plating & Fire Sealant)',60,'Lock',64),
  ('ndks','Non-compliant / Damaged Fire Door Knob Set',150,'Hardware',65),
  ('ndla','Non-Compliant Dead-Latch (Remove & replace with fire rated plate/plug & fire sealant)',90,'Lock',66),
  ('ndls','Non-compliant / Damaged Fire Door Lever Set',165,'Hardware',67),
  ('ndv','Non complaint door viewer or incorrectly installed, need to be replaced',50,'Hardware',68),
  ('nfbs','Non fire rated bottom seal has been installed — require to remove',35,'Seal',69),
  ('nfd','Fire Door Inconsistencies — Recheck Required',25,'Compliance',70),
  ('nfss','A non-fire rated smoke seal has been installed — require to remove',35,'Seal',71),
  ('nha','Need to Replace Heat Alarm',155,'Alarm',72),
  ('ni','No interconnection between the smoke alarms, require electrician to investigate',NULL,'Alarm',73),
  ('none','Not applicable — no need to inspect.',NULL,'Compliance',74),
  ('ns','No Sound Fault',NULL,'Alarm',75),
  ('nsa','Need to replace Smoke Alarm 240v',90,'Alarm',76),
  ('nsa9','Need to replace 9V Smoke Alarm',60,'Alarm',77),
  ('ntd','No compliance tag on the door',75,'Compliance',78),
  ('ntf','No compliance tag on the frame',75,'Compliance',79),
  ('obs','Obstructions in Common Area adj to entrance door',NULL,'Access',80),
  ('p','Passed',NULL,'General',81),
  ('pel','Non-Compliant Electronic Lock installed as primary lock',350,'Lock',82),
  ('ptd','The compliance tag is painted on door; requires to be paint stripped / reinspected',35,'Compliance',83),
  ('ptf','The compliance tag is painted on frame; requires to be paint stripped / reinspected',35,'Compliance',84),
  ('rb','Replaced Battery',10,'Alarm',85),
  ('rba','Replaced Battery (for annual compliance)',10,'Alarm',86),
  ('rc','Repair cables and/or terminals',35,'Alarm',87),
  ('rd','Rehang Door',75,'Hardware',88),
  ('rh','Remove Door, Rebate Hinge, Rehang',75,'Hinge',89),
  ('rha','Replaced Heat Alarm',155,'Alarm',90),
  ('ri','Require electrical investigation $85.00+GST p/hr',NULL,'Alarm',91),
  ('ros','Sprinkler head — removed minor obstruction',NULL,'General',92),
  ('rr','Re-inspection Required',NULL,'Compliance',93),
  ('rsa','Replaced Smoke Alarm',90,'Alarm',94),
  ('rsa9','Replaced 9V Smoke Alarm',60,'Alarm',95),
  ('rsb','Hanging off Ceiling (Reattached Smoke Alarm Base to Ceiling)',25,'Alarm',96),
  ('rtc','Require to Retension & Adjust Faulty Closer',25,'Hardware',97),
  ('rw','Re-wound hose during the inspection',25,'General',98),
  ('s12','Hardwired to Fire Panel',NULL,'Alarm',99),
  ('s24','240v Hardwired with 9V Battery back up',NULL,'Alarm',100),
  ('s24n','240v Hardwired with nonreplaceable battery backup',NULL,'Alarm',101),
  ('s9','Nonhardwired 9V Battery only',NULL,'Alarm',102),
  ('s9n','Nonhardwired nonreplaceable battery backup',NULL,'Alarm',103),
  ('sd','Security Device (remove & fill holes with Fire Sealant)',25,'Hardware',104),
  ('seq','Sequencer requires adjusting; if adjusting fails replace sequencer $195.00+GST',25,'Hardware',105),
  ('sh','Hardware requires servicing',25,'Hardware',106),
  ('sor','Sprinkler Obstruction Removed',NULL,'General',107),
  ('ted','Top Edge Delamination',215,'Delamination',108),
  ('tg','Top Gap',35,'Gap',109),
  ('tgt','Top Gap exceeding 3mm due to the door edge planed with a taper',NULL,'Gap',110),
  ('tgx','Top Gap 8mm+',75,'Gap',111),
  ('tl','Top Lock not latching correctly',NULL,'Lock',112),
  ('tsc','Top Side Contact',25,'Hardware',113),
  ('tss','Top Inside Smoke Seal damaged/Missing (Required to be Replaced)',25,'Seal',114),
  ('tsx','Top External Smoke Seal damaged/Missing (Required to be Replaced)',40,'Seal',115),
  ('wa','Didn''t go into emergency mode during the test; require electrician to investigate $85.00+GSTp/h',NULL,'Alarm',116),
  ('warp','The Fire Door is warped out of shape and is not latching correctly',150,'Hardware',117),
  ('wl1','1 window lock — missing/damaged',35,'Window',118),
  ('wl2','2 window locks — missing/damaged',65,'Window',119),
  ('wl3','3 window locks — missing/damaged',90,'Window',120),
  ('wl4','4 window locks — missing/damaged',115,'Window',121),
  ('wl5','5 window locks — missing/damaged',140,'Window',122),
  ('wr','Welding Required & may require Fire Detection Isolations $250.00+GST',400,'Hardware',123)
ON CONFLICT (code) DO NOTHING;
```

*Size: **336** lines of code.*

---

## 📄 `supabase/migrations/users_compliance_patch.sql`

> **Description:** Contains specific implementation logic for this module.
>
> **What we expect from it:** Database migration or configuration script. **We expect this to modify the remote PostgreSQL schema.**

### Core Code Logic & Implementations:

#### Raw File Source
```sql
-- Add compliance and licensing fields to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fpas_number TEXT,
  ADD COLUMN IF NOT EXISTS fpas_class TEXT,
  ADD COLUMN IF NOT EXISTS fpas_expiry DATE,
  ADD COLUMN IF NOT EXISTS state_license TEXT,
  ADD COLUMN IF NOT EXISTS state_license_expiry DATE;

-- Update the schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
```

*Size: **11** lines of code.*

---

