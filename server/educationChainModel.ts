import { existsSync, readFileSync } from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { projects, receiptChain, runs, scheduledTargets } from "@shared/schema";
import type { ReceiptChainRow } from "@shared/schema";
import {
  buildEvidenceChainModel,
  type ChainReceiptInput,
  type EvidenceChainModel,
} from "@shared/evidenceChainModel";
import { verifyChainRowsOrdered } from "./chain/verifyChainRows";
import { analyzerQueue } from "./queue/analyzer-queue";
import { enrichBuildHistoryWithHighlightIds, inferBuildHistory } from "./buildHistory";
import type { BuildHistoryPayload } from "@shared/evidenceChainModel";
import { buildKeyStatuses } from "./keys/buildKeyStatuses";

function loadSecretsFindingsCount(runDir: string | null | undefined): number {
  if (!runDir?.trim()) return 0;
  const base = path.isAbsolute(runDir) ? runDir : path.resolve(process.cwd(), runDir);
  const file = path.join(base, "secrets_scan.json");
  if (!existsSync(file)) return 0;
  try {
    const j = JSON.parse(readFileSync(file, "utf8")) as { findings_count?: number };
    return typeof j.findings_count === "number" ? j.findings_count : 0;
  } catch {
    return 0;
  }
}

function rowToInput(row: ReceiptChainRow): ChainReceiptInput {
  return {
    runId: row.runId,
    receiptType: row.receiptType,
    chainSequence: row.chainSequence,
    previousReceiptHash: row.previousReceiptHash,
    receiptHash: row.receiptHash,
    anomalyFlagged: row.anomalyFlagged,
    newCves: (row.newCves as unknown[]) ?? [],
    timestamp: row.timestamp,
  };
}

/**
 * Resolve education model for a debrief run (`runs.id`).
 */
export async function getEducationChainModelForRun(runId: number): Promise<EvidenceChainModel | null> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, run.projectId))
    .limit(1);
  if (!project) return null;

  const [target] = await db
    .select()
    .from(scheduledTargets)
    .where(eq(scheduledTargets.debriefProjectId, run.projectId))
    .limit(1);

  const chainRows = target
    ? await db
        .select()
        .from(receiptChain)
        .where(eq(receiptChain.targetId, target.id))
        .orderBy(receiptChain.chainSequence)
    : [];

  const receipts = chainRows.map(rowToInput);
  const verification = verifyChainRowsOrdered(chainRows);
  const receiptForRun =
    chainRows.find((r) => r.runId === String(runId)) ?? null;

  const analyzerCompleted = run.analysisId != null;
  const analyzerFailed = !analyzerCompleted && project.status === "failed";

  const exportSigningConfigured = Boolean(
    process.env.DEBRIEF_CHAIN_EXPORT_PRIVATE_KEY?.trim() ||
      process.env.DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY?.trim(),
  );

  const usesAnalyzerJobQueue = analyzerQueue() != null;

  const minimal = !target || chainRows.length === 0;

  const secretsFindingsCount = loadSecretsFindingsCount(run.runDir);
  const keyStatuses = buildKeyStatuses();

  const core = buildEvidenceChainModel({
    runId,
    projectId: project.id,
    projectName: project.name,
    projectUrl: project.url,
    chainTargetId: target?.id ?? null,
    receipts,
    verification: {
      chainIntact: verification.chainIntact,
      brokenAtSequence: verification.brokenAtSequence,
      gapsCount: verification.gapsCount,
      anomaliesCount: verification.anomaliesCount,
    },
    analyzerCompleted,
    analyzerFailed,
    receiptForRun: receiptForRun ? rowToInput(receiptForRun) : null,
    exportSigningConfigured,
    usesAnalyzerJobQueue,
    minimal,
    secretsFindingsCount,
    keyStatuses,
  });

  let buildHistory: BuildHistoryPayload = { events: [], historyAvailable: false };
  if (run.runDir) {
    try {
      buildHistory = await inferBuildHistory(run.runDir);
    } catch {
      buildHistory = { events: [], historyAvailable: false };
    }
  }

  return {
    ...core,
    buildHistory: enrichBuildHistoryWithHighlightIds(buildHistory, core.nodes),
  };
}
