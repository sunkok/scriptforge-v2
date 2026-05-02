import { Suspense } from "react";
import PrintClient from "./PrintClient";

export default function PrintPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem" }}>Loading…</div>}>
      <PrintClient />
    </Suspense>
  );
}
