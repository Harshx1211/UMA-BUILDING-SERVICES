// This file remounts on every navigation, unlike layout.tsx which persists.
// That's the whole reason it exists: animate-page-enter needs to replay each
// time the user moves to a new page, and layout.tsx can't do that.
export default function Template({ children }: { children: React.ReactNode }) {
  return <main className="animate-page-enter">{children}</main>;
}
