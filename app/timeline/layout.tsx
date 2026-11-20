import { Sky } from "@/components/sky";
import { Wordmark } from "@/components/wordmark";
import { signOut } from "./actions";

export default function TimelineLayout({ children }: LayoutProps<"/timeline">) {
  return (
    <>
      <Sky />
      <div className="inner">
        <nav className="start-nav" aria-label="Site">
          <Wordmark href="/timeline" />
          <form action={signOut}>
            <button type="submit" className="nav-action">
              Sign out
            </button>
          </form>
        </nav>
        {children}
      </div>
    </>
  );
}
