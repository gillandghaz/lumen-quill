/** Re-mounted on every navigation inside the app: gives each page a soft fade-and-rise entrance. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
