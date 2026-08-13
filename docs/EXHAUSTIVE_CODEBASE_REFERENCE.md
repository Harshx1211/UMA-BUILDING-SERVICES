# SiteTrack App — Exhaustive File-by-File Technical Reference

This document provides a 100% exhaustive breakdown of every single file in the SiteTrack codebase, including all exported functions, components, hooks, constants, and the explicit technical logic contained within each file.

## `app/(app)/defects/index.tsx`

**Description:** Global Defects Screen — app/(app)/defects/index.tsx Cross-job view of all defects with filtering, status badges, and navigation to detail.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function GlobalDefectsScreen()`: The primary export of this file.

*Size: 316 lines of code.*

---

## `app/(app)/help.tsx`

**Description:** SiteTrack — Help & Support Screen Accordion guides, FAQ, feedback email, walkthrough replay, app version

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function HelpScreen()`: The primary export of this file.

*Size: 332 lines of code.*

---

## `app/(app)/index.tsx`

**Description:** Home Screen — SiteTrack Design rules enforced here: - All colors from T.* tokens only — zero hardcoded hex values - KPI stat numbers are neutral (T.textPrimary) — not semantic colors - No emoji anywhere in UI copy - Status badges use the shared <Badge> component - Empty state uses <EmptyState> with a vector icon, not a 🎉 - Section labels are sentence-case via <SectionHeader> - Notification bell uses MaterialCommunityIcons, not a 🔔 emoji

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function HomeScreen()`: The primary export of this file.

*Size: 467 lines of code.*

---

## `app/(app)/jobs/index.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function ScheduleScreen()`: The primary export of this file.

*Size: 238 lines of code.*

---

## `app/(app)/jobs/[id]/defects/[defectId].tsx`

**Description:** Defect Detail Screen — app/(app)/jobs/[id]/defects/[defectId].tsx Access rules: - Job is IN PROGRESS  → read-only info card + Delete button (mistake correction) - Job is COMPLETED    → fully read-only, no delete, locked notice shown - Status changes and pricing are ALWAYS admin-only (no chips on mobile)

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function DefectDetailScreen()`: The primary export of this file.

*Size: 416 lines of code.*

---

## `app/(app)/jobs/[id]/defects.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function DefectsScreen()`: The primary export of this file.

*Size: 149 lines of code.*

---

## `app/(app)/jobs/[id]/index.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function JobDetailScreen()`: The primary export of this file.

*Size: 934 lines of code.*

---

## `app/(app)/jobs/[id]/inspect.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function AssetInspectionScreen()`: The primary export of this file.

*Size: 648 lines of code.*

---

## `app/(app)/jobs/[id]/photos.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function PhotosScreen()`: The primary export of this file.

*Size: 128 lines of code.*

---

## `app/(app)/jobs/[id]/preview.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function PreviewScreen()`: The primary export of this file.

*Size: 392 lines of code.*

---

## `app/(app)/jobs/[id]/quote.tsx`

**Description:** Quote Screen — app/(app)/jobs/[id]/quote.tsx Read-only summary for the technician. Defects are grouped by severity (Critical / Major / Minor). Prices shown if admin has set them — otherwise "Unquoted". Total is summed from quote_price values. No editing on this screen — all quote management is admin-only.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function QuoteScreen()`: The primary export of this file.

*Size: 241 lines of code.*

---

## `app/(app)/jobs/[id]/report.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function ReportSummaryScreen()`: The primary export of this file.

*Size: 671 lines of code.*

---

## `app/(app)/jobs/[id]/signature.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function SignatureScreen()`: The primary export of this file.

*Size: 529 lines of code.*

---

## `app/(app)/jobs/_layout.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function JobsLayout()`: The primary export of this file.

*Size: 9 lines of code.*

---

## `app/(app)/notifications/index.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function NotificationsScreen()`: The primary export of this file.

*Size: 216 lines of code.*

---

## `app/(app)/profile.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function ProfileScreen()`: The primary export of this file.

*Size: 222 lines of code.*

---

## `app/(app)/properties/site-inspect/[id].tsx`

**Description:** On-Site Inspection Form — launched from the Property Detail screen. Allows a technician to: • Mark each asset as Pass / Fail / N/T • Log a defect reason when failing an asset (inline — no modal needed) • Add new assets discovered on-site via AddAssetModal • Complete the inspection — results saved as a job+job_assets record

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function SiteInspectScreen()`: The primary export of this file.

*Size: 785 lines of code.*

---

## `app/(app)/properties/site-inspect/_layout.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function SiteInspectLayout()`: The primary export of this file.

*Size: 8 lines of code.*

---

## `app/(app)/properties/[id].tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function PropertyDetailScreen()`: The primary export of this file.

*Size: 536 lines of code.*

---

## `app/(app)/properties/_layout.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function PropertiesLayout()`: The primary export of this file.

*Size: 9 lines of code.*

---

## `app/(app)/_layout.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function AppLayout()`: The primary export of this file.

*Size: 299 lines of code.*

---

## `app/(auth)/forgot-password.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function ForgotPasswordScreen()`: The primary export of this file.

*Size: 225 lines of code.*

---

## `app/(auth)/index.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function SplashScreen()`: The primary export of this file.

*Size: 116 lines of code.*

---

## `app/(auth)/login.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function LoginScreen()`: The primary export of this file.

*Size: 350 lines of code.*

---

## `app/(auth)/_layout.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function AuthLayout()`: The primary export of this file.

*Size: 21 lines of code.*

---

## `app/_layout.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Defines a navigable screen or layout in the Expo Router structure. We expect this to render UI and handle user interactions for a specific route.

**Code & Functions inside:**
- `default function RootLayout()`: The primary export of this file.
- `function ErrorBoundary({ error, retry }: ErrorBoundaryProps)`: Executes logic related to  error boundary.

*Size: 177 lines of code.*

---

## `components/camera/index.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 3 lines of code.*

---

## `components/camera/PhotoCaptureSheet.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `PhotoCaptureSheetRef`: Type definition.

*Size: 293 lines of code.*

---

## `components/camera/PhotoGrid.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `default function PhotoGrid({ photos, onPhotoLongPress }: Props)`: The primary export of this file.

*Size: 141 lines of code.*

---

## `components/defects/AddDefectSheet.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `AddDefectSheetRef`: Type definition.

*Size: 521 lines of code.*

---

## `components/defects/DefectCard.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `default function DefectCard({ defect, onPress, onEdit }: Props)`: The primary export of this file.

*Size: 206 lines of code.*

---

## `components/defects/DefectCodePicker.tsx`

**Description:** DefectCodePicker.tsx — Searchable Uptick-style defect code picker Matches the UI from Uptick Image 6: - Search bar filters codes + descriptions in real-time - "Custom Note" always at top - Code bold + description grey + price badge (green) - Category grouping with icons

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `default function DefectCodePicker({ visible, onSelect, onClose }: DefectCodePickerProps)`: The primary export of this file.

*Size: 438 lines of code.*

---

## `components/defects/index.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 4 lines of code.*

---

## `components/inspections/AddAssetModal.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `default function AddAssetModal({ visible, propertyId, onClose, onAssetAdded }: AddAssetModalProps)`: The primary export of this file.

*Size: 566 lines of code.*

---

## `components/inspections/AssetInspectModal.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `default function AssetInspectModal({ visible, asset, jobId, onClose, onSaveFail }: AssetInspectModalProps)`: The primary export of this file.

*Size: 553 lines of code.*

---

## `components/inspections/ChecklistModal.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `default function ChecklistModal({ visible, assetType, items, initialData, onSave, onCancel, }: ChecklistModalProps)`: The primary export of this file.

*Size: 282 lines of code.*

---

## `components/inspections/EditAssetModal.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `default function EditAssetModal({ visible, asset, onClose, onAssetEdited }: EditAssetModalProps)`: The primary export of this file.

*Size: 215 lines of code.*

---

## `components/inspections/index.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 4 lines of code.*

---

## `components/jobs/CompletionBottomSheet.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `default function CompletionBottomSheet({ visible, onClose, onConfirm, assetsTotal, assetsInspected, hasSignature, hasDefects, onNeedSignature }: Props)`: The primary export of this file.

*Size: 110 lines of code.*

---

## `components/jobs/index.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 8 lines of code.*

---

## `components/jobs/JobCard.tsx`

**Description:** JobCard — professional enterprise card with priority strip, status badge, and swipe actions. Clean, data-rich layout with strong typography and clear visual hierarchy.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `const JobCard`: Exported constant or arrow function.

*Size: 250 lines of code.*

---

## `components/jobs/JobTypeBadge.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function JobTypeBadge({ jobType }: Props)`: Executes logic related to  job type badge.

*Size: 41 lines of code.*

---

## `components/jobs/RouteMapView.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `default function RouteMapView({ jobs, onJobSelect }: Props)`: The primary export of this file.

*Size: 269 lines of code.*

---

## `components/jobs/RouteMapView.web.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `default function RouteMapView()`: The primary export of this file.

*Size: 19 lines of code.*

---

## `components/jobs/SignatureModal.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function SignatureModal({ visible, onClose, onSign, clientName }: Props)`: Executes logic related to  signature modal.

*Size: 121 lines of code.*

---

## `components/jobs/StatusBadge.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function StatusBadge({ status, small = false }: Props)`: Executes logic related to  status badge.

*Size: 76 lines of code.*

---

## `components/OfflineBanner.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function OfflineBanner()`: Executes logic related to  offline banner.

*Size: 148 lines of code.*

---

## `components/SyncStatusBar.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function SyncStatusBar({ light = false }: Props)`: Executes logic related to  sync status bar.

*Size: 150 lines of code.*

---

## `components/ui/Badge.tsx`

**Description:** Badge — status pill. Color is driven entirely by semantic status tokens. Status → Color mapping (applied identically everywhere a status appears): in_progress / inProgress → warning (amber) scheduled               → info (blue) completed               → success (green) cancelled               → muted (slate) pass                    → success fail                    → danger open                    → danger quoted / monitoring     → warning repaired                → success urgent                  → danger high                    → warning normal / low            → muted Usage:  <Badge status="in_progress" />  or  <Badge status="completed" />

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function Badge({ status, label }: BadgeProps)`: Executes logic related to  badge.

*Size: 114 lines of code.*

---

## `components/ui/Button.tsx`

**Description:** Button — three strict variants, consistent dimensions everywhere. Variants: primary     — filled orange, white text. CTAs only: "Start Job", "Save", "Complete" secondary   — ghost/outline style (border + transparent bg). Secondary actions. destructive — red fill. Destructive actions: "Delete", "Remove", "Discard" Height: 48px always (large). Small = 36px for inline/secondary contexts. Radius: T.radiusButton (10px) always. Do NOT pass a custom `color` to make an orange icon or a navy button. If your use case isn't covered by these three variants, question whether you need a button at all — or open a PR to add a justified new variant.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function Button({ onPress, title, variant = 'primary', size = 'large', loading, isLoading, disabled, icon, style, textStyle, }: ButtonProps)`: Executes logic related to  button.

*Size: 146 lines of code.*

---

## `components/ui/Card.tsx`

**Description:** Card — the single container used for every info block in SiteTrack. Variants: default  — standard surface card (nav, job details, stat tiles) warning  — amber-tinted for pending / attention states danger   — red-tinted for hazards, failed inspections, destructive banners info     — blue-tinted for access notes, navigation hints success  — green-tinted for completed / passed states Do NOT hand-style background/border on any container. Pick the right variant and let this component handle it.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function Card({ children, variant = 'default', style, padding = T.space16, noPadding, onPress, }: CardProps)`: Executes logic related to  card.
- `const cardShadow`: Exported constant or arrow function.

*Size: 103 lines of code.*

---

## `components/ui/EmptyState.tsx`

**Description:** EmptyState — uniform empty state used across every zero-data screen. Rules: - No emoji. A muted MaterialCommunityIcons icon only. - Title in Typography.cardTitle (sentence case, not all-caps). - Subtitle in Typography.body. - CTA button uses Button variant="primary" if provided. Usage: <EmptyState icon="calendar-blank-outline" title="No jobs scheduled today" subtitle="Your queue is clear. Pull to refresh." />

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps)`: Executes logic related to  empty state.

*Size: 92 lines of code.*

---

## `components/ui/FilterPills.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function FilterPills({ options, activeIndex, onSelect, style, variant = 'light' }: FilterPillsProps)`: Executes logic related to  filter pills.
- `FilterPillOption`: Type definition.
- `FilterPillsProps`: Type definition.

*Size: 130 lines of code.*

---

## `components/ui/FormField.tsx`

**Description:** FormField — standardized label-above-input pattern used everywhere a user types. Enforces: - Consistent label typography (Typography.label) - Consistent input background (T.surfaceInput) - Consistent border (T.border, focused → T.primary) - Consistent radius (T.radiusButton = 10px) - Consistent placeholder color (T.textMuted) Usage: <FormField label="Client Name" value={name} onChangeText={setName} /> <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function FormField({ label, error, containerStyle, multiline, ...inputProps }: FormFieldProps)`: Executes logic related to  form field.

*Size: 100 lines of code.*

---

## `components/ui/index.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 12 lines of code.*

---

## `components/ui/Input.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function Input({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, error, disabled, multiline, numberOfLines, maxLength, leftIcon, rightIcon, style }: InputProps)`: Executes logic related to  input.
- `InputProps`: Type definition.

*Size: 121 lines of code.*

---

## `components/ui/ScreenHeader.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function ScreenHeader({ title, subtitle, rightComponent, showBack = false, eyebrow, }: Props)`: Executes logic related to  screen header.

*Size: 125 lines of code.*

---

## `components/ui/SectionHeader.tsx`

**Description:** SectionHeader — eyebrow-style label used above every section group. This is a DISPLAY component, not a full page header. For page-level headers use ScreenHeader. Usage: <SectionHeader title="Today's Jobs" /> <SectionHeader title="Quick Actions" rightLabel="See all" onRightPress={...} /> Renders as sentence-case with a muted color — NOT all-caps (that's eyebrow style). If you want the eyebrow variant pass eyebrow={true}.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function SectionHeader({ title, eyebrow = false, rightLabel, onRightPress, style, }: SectionHeaderProps)`: Executes logic related to  section header.

*Size: 77 lines of code.*

---

## `components/ui/SectionTitle.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function SectionTitle({ title, count, rightLabel, onRightPress }: Props)`: Executes logic related to  section title.

*Size: 69 lines of code.*

---

## `components/ui/SkeletonCard.tsx`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Reusable React component. We expect this to receive props and render a specific piece of the UI independently.

**Code & Functions inside:**
- `function SkeletonBlock({ width, height, borderRadius = 8, style }: SkeletonBlockProps)`: Executes logic related to  skeleton block.
- `function SkeletonCard()`: Executes logic related to  skeleton card.

*Size: 97 lines of code.*

---

## `constants/AssetData.ts`

**Description:** AssetData.ts — Single source of truth for all fire-safety asset types, their sub-variants, inspection routines, display icons and colours. Extracted from 25 real-world Uptick screenshots captured on a live job (T-14231) CA 2026 - 153 Parramatta... Structure mirrors the "Edit Asset" form in the reference app: Type → Variant → Inspection Routine (auto-assigned) → Location → Ref

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `function getInspectionRoutine(assetType: string)`: Executes logic related to get inspection routine.
- `function getVariantsForType(assetType: string)`: Executes logic related to get variants for type.
- `function getAssetTypeIcon(assetType: string)`: Executes logic related to get asset type icon.
- `function getAssetTypeColor(assetType: string)`: Executes logic related to get asset type color.
- `AssetTypeDefinition`: Type definition.

*Size: 308 lines of code.*

---

## `constants/Checklists.ts`

**Description:** Checklists.ts — Compliance checklist definitions for all 9 official fire safety asset types. Keys MUST exactly match the `value` field in AssetData.ts ASSET_TYPES. Each checklist is used by ChecklistModal during an inspection. When a checklist is completed and all items pass → asset result = Pass. If any item fails → technician is prompted to log a defect.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `ChecklistItem`: Type definition.
- `ChecklistTemplate`: Type definition.

*Size: 149 lines of code.*

---

## `constants/Colors.ts`

**Description:** SiteTrack — Single Design Token Source of Truth SiteTrack is a dark-only field service app. There is no light mode. useColors() always returns this palette. Rule: Every color in the app must trace back to one of these tokens. No hardcoded hex values outside this file — ever.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `const T`: Exported constant or arrow function.

*Size: 184 lines of code.*

---

## `constants/Company.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `const CompanyConfig`: Exported constant or arrow function.

*Size: 10 lines of code.*

---

## `constants/Config.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `const SYNC_INTERVAL_MS`: Exported constant or arrow function.
- `const MAX_PHOTOS_PER_DEFECT`: Exported constant or arrow function.
- `const APP_NAME`: Exported constant or arrow function.
- `const BUNDLE_ID`: Exported constant or arrow function.
- `const OFFLINE_CACHE_DAYS`: Exported constant or arrow function.
- `const DB_NAME`: Exported constant or arrow function.
- `const LAST_SYNCED_KEY`: Exported constant or arrow function.
- `const SESSION_KEY`: Exported constant or arrow function.
- `const PAGE_SIZE`: Exported constant or arrow function.
- `const REQUEST_TIMEOUT_MS`: Exported constant or arrow function.

*Size: 33 lines of code.*

---

## `constants/DefectCodes.ts`

**Description:** DefectCodes.ts — Uptick Australia Defect Code Library Complete codebook extracted from the Uptick Australia reference spreadsheet. Codes cover fire doors, smoke seals, hardware, alarms, smoke detectors, windows, and general issues. quote_price: Reference rate in AUD (ex-GST). These are Uptick industry reference rates. — Can be overridden per-job on the quote screen. — Can be updated here or via Supabase config as pricing changes. category: Used to group codes in the picker UI.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `function findDefectCode(code: string)`: Executes logic related to find defect code.
- `function getDefectsByCategory(category: DefectCategory)`: Executes logic related to get defects by category.
- `function searchDefectCodes(query: string)`: Executes logic related to search defect codes.
- `DefectCode`: Type definition.
- `DefectCategory`: Type definition.

*Size: 830 lines of code.*

---

## `constants/Enums.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 84 lines of code.*

---

## `constants/headerPad.ts`

**Description:** Shared safe-area top padding for screen headers. Uses the actual status bar height on Android so headers never eat into the status bar area. On iOS the root layout already accounts for the notch.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `const HEADER_TOP_PAD`: Exported constant or arrow function.

*Size: 11 lines of code.*

---

## `constants/Typography.ts`

**Description:** Typography Scale — single source of truth. Rules: - eyebrow is the ONLY place all-caps text appears in the app. - Section titles are sentence-case, not screaming caps. - Nothing outside this file should hardcode fontSize/fontWeight. NOTE: Color is intentionally NOT embedded in these styles. Apply color separately via { color: T.textPrimary } etc. This keeps typography portable and avoids circular import issues.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `const Typography`: Exported constant or arrow function.

*Size: 76 lines of code.*

---

## `hooks/use-color-scheme.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 2 lines of code.*

---

## `hooks/use-color-scheme.web.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `function useColorScheme()`: Executes logic related to use color scheme.

*Size: 22 lines of code.*

---

## `hooks/use-theme-color.ts`

**Description:** Learn more about light and dark modes: https://docs.expo.dev/guides/color-schemes/

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `function useThemeColor(props: { light?: string; dark?: string }, colorName: keyof typeof Colors.dark)`: Executes logic related to use theme color.

*Size: 22 lines of code.*

---

## `hooks/useAuth.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `function useAuth()`: Executes logic related to use auth.

*Size: 43 lines of code.*

---

## `hooks/useColors.ts`

**Description:** useColors — always returns the dark navy palette. SiteTrack is a field-service app designed for technicians working on-site. The dark navy theme (#0F1E3C / #182745 / #2D4068 / #E8650A) is the primary design language matching the Project Work prototype and the app.json setting of userInterfaceStyle: "dark". We do NOT switch to the light theme based on system preferences — the app is always dark to maintain consistent field-app aesthetics. Usage:  const C = useColors();  →  C.primary, C.surface, C.accent …

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `function useColors()`: Executes logic related to use colors.

*Size: 19 lines of code.*

---

## `hooks/useNetworkStatus.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `function useNetworkStatus()`: Executes logic related to use network status.

*Size: 67 lines of code.*

---

## `lib/database.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core business logic module. We expect this to handle data processing, database interactions, or external integrations.

**Code & Functions inside:**
- `function openDatabase()`: Executes logic related to open database.
- `function initializeSchema()`: Executes logic related to initialize schema.
- `function insertRecord(table: string, data: RecordData)`: Executes logic related to insert record.
- `function updateRecord(table: string, id: string, data: RecordData,)`: Executes logic related to update record.
- `function deleteRecord(table: string, id: string)`: Executes logic related to delete record.
- `function cleanOldSyncQueueItems()`: Executes logic related to clean old sync queue items.
- `function clearFailedSyncItems(tableName: string)`: Executes logic related to clear failed sync items.
- `function resetStaleFailedSyncItems(cooldownMs: number = 24 * 60 * 60 * 1000)`: Executes logic related to reset stale failed sync items.
- `function retryAllFailedSyncItems()`: Executes logic related to retry all failed sync items.
- `function getActiveTimeLog(jobId: string, userId: string)`: Executes logic related to get active time log.
- `function getJobAssetRecord(jobId: string, assetId: string)`: Executes logic related to get job asset record.
- `function addToSyncQueue(tableName: string, recordId: string, operation: SyncOperation | 'photo_upload', payload: RecordData,)`: Executes logic related to add to sync queue.
- `function cancelPendingPhotoUpload(recordId: string)`: Executes logic related to cancel pending photo upload.
- `function recordDeletedPhoto(photoId: string)`: Executes logic related to record deleted photo.
- `function getDeletedPhotoIds()`: Executes logic related to get deleted photo ids.
- `function getPendingSyncItems(maxRetries = 5)`: Executes logic related to get pending sync items.
- `function getFailedSyncItems()`: Executes logic related to get failed sync items.
- `function markSyncItemComplete(id: number)`: Executes logic related to mark sync item complete.
- `function incrementSyncRetry(id: number, errorMessage: string, maxRetries = 5,)`: Executes logic related to increment sync retry.
- `function upsertRecord(table: string, data: RecordData)`: Executes logic related to upsert record.
- `function getJobStatus(jobId: string)`: Executes logic related to get job status.
- `function seedInventoryFromDefectCodes()`: Executes logic related to seed inventory from defect codes.
- `function getUnreadNotificationCount(userId: string)`: Executes logic related to get unread notification count.
- `function clearDatabase()`: Executes logic related to clear database.
- `RecordData`: Type definition.

*Size: 2037 lines of code.*

---

## `lib/notifications.ts`

**Description:** UMA BUILDING SERVICES — Daily Summary Notification Scheduler Schedules a local "Job summary" notification at 6:00 PM each day. Requires expo-notifications (already installed). Only schedules if the user has granted permission.

**What we expect from it:** Core business logic module. We expect this to handle data processing, database interactions, or external integrations.

**Code & Functions inside:**
- `function requestNotificationPermission()`: Executes logic related to request notification permission.
- `function scheduleDailySummaryNotification(jobCount: number, pendingCount: number)`: Executes logic related to schedule daily summary notification.
- `function cancelDailySummaryNotification()`: Executes logic related to cancel daily summary notification.
- `function scheduleJobReminder(jobId: string, propertyName: string, scheduledDate: string, scheduledTime: string | null)`: Executes logic related to schedule job reminder.
- `function configureNotificationHandler()`: Executes logic related to configure notification handler.

*Size: 118 lines of code.*

---

## `lib/pdfConstants.ts`

**Description:** lib/pdfConstants.ts Shared constants between pdfGenerator.ts and reportTemplate.ts. Pulled into its own module because pdfGenerator.ts imports buildReportHtml from reportTemplate.ts — if reportTemplate.ts tried to import FALLBACK_IMG back from pdfGenerator.ts, that would be a circular import. Keeping shared constants here avoids the cycle entirely.

**What we expect from it:** Core business logic module. We expect this to handle data processing, database interactions, or external integrations.

**Code & Functions inside:**
- `const FALLBACK_IMG`: Exported constant or arrow function.

*Size: 14 lines of code.*

---

## `lib/pdfGenerator.ts`

**Description:** lib/pdfGenerator.ts Generates and shares a PDF service report for a completed job. Key improvements: - All images converted to data: URIs before HTML is built (expo-print WKWebView sandbox cannot load file:// or https:// URIs) - Sequential encoding with per-image error isolation - Defect photos prioritised in the MAX_ENCODED_PHOTOS budget - Signature encoded as JPEG (3× smaller than PNG) - Temp files cleaned up in finally blocks - Detailed progress stages for UI feedback Size presets (encode at ~1.2–1.5× CSS display size): CSS display          Encode at 72 × 72  (thumb)  →  110px wide 220 × 165 (defect) →  320px wide 64px tall (sig)    →  260px wide

**What we expect from it:** Core business logic module. We expect this to handle data processing, database interactions, or external integrations.

**Code & Functions inside:**
- `function generateJobReport(jobId: string, onProgress?: ReportProgressCallback)`: Executes logic related to generate job report.
- `ReportProgressCallback`: Type definition.
- `ReportStage`: Type definition.

*Size: 822 lines of code.*

---

## `lib/photoUpload.ts`

**Description:** lib/photoUpload.ts Handles uploading locally-captured photos to Supabase Storage and keeping the local SQLite record in sync with the resulting public URL. Fix summary (this revision): 1. uploadAsync httpMethod changed from POST → PUT (Supabase Storage upsert endpoint) 2. getValidLocalUri applied to localUri before upload to handle stale Expo Go paths 3. uploaded_by included in the SyncOperation.Insert payload (was silently missing, causing Supabase FK constraint failures on servers with NOT NULL uploaded_by) 4. processPhotoQueue: early-exit if no pending photo tasks (avoids unnecessary work) 5. queuePhotoUpload: recordId fallback made explicit (was relying on 'new' string)

**What we expect from it:** Core business logic module. We expect this to handle data processing, database interactions, or external integrations.

**Code & Functions inside:**
- `function uploadPhoto(localUri: string, jobId: string, assetId?: string,)`: Executes logic related to upload photo.
- `function queuePhotoUpload(localUri: string, jobId: string, assetId?: string, recordId?: string, defectId?: string,)`: Executes logic related to queue photo upload.
- `function processPhotoQueue(currentUserId: string)`: Executes logic related to process photo queue.
- `function cleanupLocalPhotos()`: Executes logic related to cleanup local photos.

*Size: 322 lines of code.*

---

## `lib/quoteTemplate.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core business logic module. We expect this to handle data processing, database interactions, or external integrations.

**Code & Functions inside:**
- `function generateQuoteHtml(data: QuoteReportData)`: Executes logic related to generate quote html.
- `QuoteReportData`: Type definition.

*Size: 237 lines of code.*

---

## `lib/reportTemplate.ts`

**Description:** lib/reportTemplate.ts Generates the HTML that expo-print converts to a professional A4 PDF. Design: Clean corporate inspection report - Navy/slate header with orange accent brand bar - Structured info grid with clear hierarchy - Colour-coded defect severity legend - Asset rows: PASS (green) / FAIL (red) / N/T (grey) pills - Defect boxes with full photo grids - Signature block with typed name fallback - Fixed footer on every page Photo handling: - Only data: URIs are embedded (safe for expo-print sandbox) - All images use explicit px dimensions (WKWebView collapses % sizes) - Photos that failed to encode (FALLBACK_IMG) render as a labelled "Photo unavailable" placeholder rather than an invisible blank box — see isRealPhoto() below.

**What we expect from it:** Core business logic module. We expect this to handle data processing, database interactions, or external integrations.

**Code & Functions inside:**
- `function buildReportHtml(data: ReportData)`: Executes logic related to build report html.
- `AssetWithResult`: Type definition.
- `ReportData`: Type definition.

*Size: 1412 lines of code.*

---

## `lib/supabase.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core business logic module. We expect this to handle data processing, database interactions, or external integrations.

**Code & Functions inside:**
- `function getCurrentUser()`: Executes logic related to get current user.
- `function signOut()`: Executes logic related to sign out.

*Size: 91 lines of code.*

---

## `lib/sync.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Core business logic module. We expect this to handle data processing, database interactions, or external integrations.

**Code & Functions inside:**
- `function onSyncComplete(listener: SyncCompleteListener)`: Executes logic related to on sync complete.
- `function offSyncComplete(listener: SyncCompleteListener)`: Executes logic related to off sync complete.
- `function clearSyncListeners()`: Executes logic related to clear sync listeners.
- `function onSyncFailure(listener: SyncFailureListener)`: Executes logic related to on sync failure.
- `function offSyncFailure(listener: SyncFailureListener)`: Executes logic related to off sync failure.
- `function clearSyncFailureListeners()`: Executes logic related to clear sync failure listeners.
- `function startSync(userId?: string)`: Executes logic related to start sync.
- `function stopSync()`: Executes logic related to stop sync.
- `function getCachedUserId()`: Executes logic related to get cached user id.
- `function getSyncStatus()`: Executes logic related to get sync status.
- `function runSync(userId?: string)`: Executes logic related to run sync.
- `SyncFailureAlert`: Type definition.

*Size: 673 lines of code.*

---

## `store/authStore.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Zustand state store. We expect this to hold global state variables and provide mutator functions to React components.

**Code & Functions inside:**
- `const useAuthStore`: Exported constant or arrow function.
- `CompanyRecord`: Type definition.

*Size: 404 lines of code.*

---

## `store/catalogueStore.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Zustand state store. We expect this to hold global state variables and provide mutator functions to React components.

**Code & Functions inside:**
- `const useCatalogueStore`: Exported constant or arrow function.

*Size: 101 lines of code.*

---

## `store/dashboardStore.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Zustand state store. We expect this to hold global state variables and provide mutator functions to React components.

**Code & Functions inside:**
- `const useDashboardStore`: Exported constant or arrow function.

*Size: 173 lines of code.*

---

## `store/defectsStore.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Zustand state store. We expect this to hold global state variables and provide mutator functions to React components.

**Code & Functions inside:**
- `const useDefectsStore`: Exported constant or arrow function.

*Size: 230 lines of code.*

---

## `store/inspectionStore.ts`

**Description:** store/inspectionStore.ts Fix summary (this revision): 1. updateAssetResult: photos[] now written to the in-memory asset after a FAIL result. Previously photos were inserted into inspection_photos + queued for upload, but the in-memory AssetWithResult.photos array was never updated. This caused getReferencedPhotoIds in pdfGenerator to correctly include the asset, but loadAssetsForInspection had to be called again to see the photos — meaning a PDF generated in the same session as the inspection would always have blank photo slots for fail assets. 2. updateAssetResult: when updating an existing defect, photos are now also re-queued so a re-inspection with new photos doesn't silently drop them. 3. addPhotoToAsset: passes defect_id: null explicitly to queuePhotoUpload via photosStore (no change to behaviour, just made explicit for clarity). 4. Minor: consistent null coalescing, removed a stray indent on newAssets declaration.

**What we expect from it:** Zustand state store. We expect this to hold global state variables and provide mutator functions to React components.

**Code & Functions inside:**
- `const useInspectionStore`: Exported constant or arrow function.
- `AssetWithResult`: Type definition.

*Size: 485 lines of code.*

---

## `store/inventoryStore.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Zustand state store. We expect this to hold global state variables and provide mutator functions to React components.

**Code & Functions inside:**
- `const useInventoryStore`: Exported constant or arrow function.

*Size: 43 lines of code.*

---

## `store/jobsStore.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Zustand state store. We expect this to hold global state variables and provide mutator functions to React components.

**Code & Functions inside:**
- `const useJobsStore`: Exported constant or arrow function.
- `JobWithProperty`: Type definition.
- `JobFilter`: Type definition.

*Size: 187 lines of code.*

---

## `store/notificationsStore.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Zustand state store. We expect this to hold global state variables and provide mutator functions to React components.

**Code & Functions inside:**
- `const useNotificationsStore`: Exported constant or arrow function.
- `NotificationType`: Type definition.
- `AppNotification`: Type definition.

*Size: 168 lines of code.*

---

## `store/photosStore.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Zustand state store. We expect this to hold global state variables and provide mutator functions to React components.

**Code & Functions inside:**
- `const usePhotosStore`: Exported constant or arrow function.

*Size: 146 lines of code.*

---

## `store/quotesStore.ts`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Zustand state store. We expect this to hold global state variables and provide mutator functions to React components.

**Code & Functions inside:**
- `const useQuotesStore`: Exported constant or arrow function.

*Size: 212 lines of code.*

---

## `types/index.ts`

**Description:** types/index.ts Full TypeScript interfaces for all SiteTrack domain models, API responses, and form types. These MUST stay in sync with the SQLite schema in lib/database.ts (schema v29) and the Supabase remote schema. Audit rule: every field that exists in the SQLite schema must exist here. Missing fields cause silent data loss — the field is fetched from DB but TypeScript won't tell you it exists.

**What we expect from it:** Core system file.

**Code & Functions inside:**
- `User`: Type definition.
- `Property`: Type definition.
- `Asset`: Type definition.
- `Job`: Type definition.
- `JoinedJob`: Type definition.
- `TechUser`: Type definition.
- `JobAsset`: Type definition.
- `Defect`: Type definition.
- `InspectionPhoto`: Type definition.
- `Signature`: Type definition.
- `TimeLog`: Type definition.
- `InventoryItem`: Type definition.
- `Quote`: Type definition.
- `QuoteItem`: Type definition.
- `SyncQueueItem`: Type definition.
- `ApiResponse`: Type definition.
- `PaginatedResponse`: Type definition.
- `LoginForm`: Type definition.
- `InspectionForm`: Type definition.
- `DefectForm`: Type definition.
- `SyncStatus`: Type definition.
- `Coordinates`: Type definition.

*Size: 353 lines of code.*

---

## `utils/assetHelpers.ts`

**Description:** assetHelpers.ts — Display helpers for fire-safety asset types and variants. Delegates to AssetData.ts for all icon/colour lookups so there is only one source of truth.

**What we expect from it:** Utility functions. We expect pure functions that take inputs and return formatted or sanitized outputs.

**Code & Functions inside:**
- `function formatAssetType(assetType: string)`: Executes logic related to format asset type.
- `function getAssetEmoji(assetType: string)`: Executes logic related to get asset emoji.

*Size: 65 lines of code.*

---

## `utils/fileHelpers.ts`

**Description:** utils/fileHelpers.ts Fix summary (this revision): 1. getValidLocalUri: preserves subdirectory structure, not just the filename. Previously `file:///old-session/subdir/photo.jpg` would resolve to `file:///new-session/photo.jpg` (missing subdir), causing FileSystem reads to fail. 2. getValidLocalUri: strips query strings from filenames before reconstruction. 3. getValidLocalUri: returns early if uri already points to the current documentDirectory (avoids redundant stat calls on every render). 4. Added safeFilename helper for generating collision-resistant local filenames.

**What we expect from it:** Utility functions. We expect pure functions that take inputs and return formatted or sanitized outputs.

**Code & Functions inside:**
- `function getValidLocalUri(uri: string | null | undefined)`: Executes logic related to get valid local uri.
- `function safeFilename(extension = 'jpg')`: Executes logic related to safe filename.

*Size: 78 lines of code.*

---

## `utils/sanitize.ts`

**Description:** utils/sanitize.ts Input sanitization helpers for all user-facing TextInput fields. Principles: 1. Be generous — never block legitimate field data (names, addresses, notes) 2. Strip/reject only known attack patterns (script tags, SQL meta-chars, event handlers) 3. Enforce sensible field-level length limits (prevents DB bloat + PDF overflow) 4. All functions are pure — no side effects, safe to call in onChange handlers

**What we expect from it:** Utility functions. We expect pure functions that take inputs and return formatted or sanitized outputs.

**Code & Functions inside:**
- `function stripHtml(value: string)`: Executes logic related to strip html.
- `function sanitizeText(value: string, maxLength: number)`: Executes logic related to sanitize text.
- `function sanitizeForHtml(value: string | null | undefined, maxLength: number = MAX_LENGTHS.reportText,)`: Executes logic related to sanitize for html.
- `function sanitizeForDisplay(value: string | null | undefined, maxLength: number = MAX_LENGTHS.notes,)`: Executes logic related to sanitize for display.
- `const MAX_LENGTHS`: Exported constant or arrow function.

*Size: 138 lines of code.*

---

## `utils/uuid.ts`

**Description:** Cryptographically-secure RFC-4122 v4 UUID generator. Uses expo-crypto (backed by the OS CSPRNG: SecRandomCopyBytes on iOS, java.security.SecureRandom on Android) instead of Math.random(). Math.random() is NOT cryptographically secure — it is predictable and should never be used for IDs that are used as primary keys in a database or as unguessable identifiers in URLs/links. Falls back to Math.random() only if expo-crypto is unavailable (web/test env).

**What we expect from it:** Utility functions. We expect pure functions that take inputs and return formatted or sanitized outputs.

**Code & Functions inside:**
- `function generateUUID()`: Executes logic related to generate u u i d.

*Size: 29 lines of code.*

---

## `supabase/migrations/add_property_next_inspection.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 8 lines of code.*

---

## `supabase/migrations/catalogue_migration.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 406 lines of code.*

---

## `supabase/migrations/fix_photo_delete_rls.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 41 lines of code.*

---

## `supabase/migrations/fix_reports_storage.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 28 lines of code.*

---

## `supabase/migrations/multi_tenant_catalogue_patch.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 45 lines of code.*

---

## `supabase/migrations/multi_tenant_catalogue_upgrade.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 122 lines of code.*

---

## `supabase/migrations/schema.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 412 lines of code.*

---

## `supabase/migrations/settings_patch.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 6 lines of code.*

---

## `supabase/migrations/sitetrack_audit_extend.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 41 lines of code.*

---

## `supabase/migrations/sitetrack_audit_patch.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 67 lines of code.*

---

## `supabase/migrations/sitetrack_dynamic_sidebar.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 22 lines of code.*

---

## `supabase/migrations/SUPABASE_ASSETS_DEFECTS.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 336 lines of code.*

---

## `supabase/migrations/users_compliance_patch.sql`

**Description:** Contains specific implementation logic for this module.

**What we expect from it:** Database migration or configuration script. We expect this to modify the remote PostgreSQL schema.

**Code & Functions inside:**
- No explicitly exported functions or types found. This may be an internal script, a layout configuration, or purely side-effecting code.

*Size: 11 lines of code.*

---

