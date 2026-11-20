import type { Metadata } from "next";
import { Quiz } from "./quiz";

export const metadata: Metadata = { title: "Begin your reading" };

export default function BeginPage() {
  return <Quiz />;
}
