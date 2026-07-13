export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export type CheckResult = {
  check: string;
  status: CheckStatus;
  message: string;
  fix?: string;
};

export function formatResults(results: CheckResult[]): string {
  const icon: Record<CheckStatus, string> = {
    pass: "[PASS]",
    fail: "[FAIL]",
    warn: "[WARN]",
    skip: "[SKIP]",
  };

  const lines = results.map((r) => {
    const base = `${icon[r.status]} ${r.check}: ${r.message}`;
    return r.fix ? `${base}\n       Fix: ${r.fix}` : base;
  });

  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const summary =
    failed === 0 && warned === 0
      ? "All checks passed. Environment looks ready."
      : `${failed} failing, ${warned} warning(s). Fixes listed above.`;

  return [...lines, "", summary].join("\n");
}
