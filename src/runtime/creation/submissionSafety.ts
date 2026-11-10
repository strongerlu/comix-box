export const UNCERTAIN_SUBMISSION = '提交结果待核实：原请求可能已受理，已停止自动重提；请先在任务记录或服务端核对，避免重复扣费。'

export interface CreationRequestIdentity {
  requestId: string
  scope: string
  fingerprint: string
}

export type PreSubmitCreationStage = 'validation' | 'upload'
type PreSubmitCreationError = Error & { creationStage: PreSubmitCreationStage }

export function preSubmitCreationError(stage: PreSubmitCreationStage, message: string): Error {
  return Object.assign(new Error(message), { creationStage: stage })
}

export function preSubmitCreationStage(error: unknown): PreSubmitCreationStage | undefined {
  const stage = (error as Partial<PreSubmitCreationError> | undefined)?.creationStage
  return stage === 'validation' || stage === 'upload' ? stage : undefined
}

/** Tags failures of a step that runs strictly before the generation request is sent. */
export async function duringPreSubmitCreation<T>(stage: PreSubmitCreationStage, run: () => T | Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError' && !preSubmitCreationStage(error)) {
      Object.assign(error, { creationStage: stage })
    }
    throw error
  }
}

const TRANSPORT_FAILURE = /signal is aborted|operation was aborted|AbortError|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|failed to fetch|fetch failed|error sending request|network|超时|连接|网络|无上游任务\s*ID|HTTP\s*(?:408|500|502|503|504)\b/i

export function hasRecoverableResultFailure(task: { upstreamTaskId?: string; status?: string; errorMsg?: string; error?: { message?: string } }): boolean {
  return Boolean(task.upstreamTaskId) && task.status === 'failed' && TRANSPORT_FAILURE.test(task.errorMsg || task.error?.message || '')
}

export function isUncertainSubmission(task: {
  submissionUncertain?: boolean
  upstreamTaskId?: string
  status?: string
  assetStatus?: string
  errorMsg?: string
  error?: { stage?: string; message?: string }
}): boolean {
  if (task.upstreamTaskId || task.assetStatus === 'local' || task.status === 'success') return false
  if (task.submissionUncertain) return true
  if (!['failed', 'cancelled'].includes(task.status || '') || task.error?.stage === 'upload' || task.error?.stage === 'validation') return false
  const detail = task.errorMsg || task.error?.message || ''
  if (/HTTP\s*(?:400|401|403|404|409|413|415|422|429)\b/i.test(detail)) return false
  return TRANSPORT_FAILURE.test(detail)
}
