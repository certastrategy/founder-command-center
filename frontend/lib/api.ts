/**
 * FCC V1.1 --- Frontend API Client
 * All calls go through /api/* which Next.js rewrites to the FastAPI backend.
 */

// --- Types ---

export interface TaskRequest {
  title: string
  task_type: string
  background: string
  goal: string
  constraints: string
  desired_outputs: string
}

export interface TaskResponse {
  task_id: string
  status: string
}

export interface StepStatus {
  department: string
  status: "pending" | "running" | "completed" | "failed"
  duration: number | null
}

export interface TaskStatus {
  task_id: string
  status: "queued" | "running" | "completed" | "failed"
  workflow_key: string
  workflow_name: string
  current_step: number
  steps: StepStatus[]
  total_duration: number | null
  error: string | null
}

export interface StepOutput {
  department: string
  dept_id: string
  output: string
  duration: number
  is_final: boolean
}

export interface TaskOutput {
  task_id: string
  status: string
  final_output: string
  step_outputs: StepOutput[]
}

export interface TaskTrace {
  task_id: string
  title: string
  workflow_key: string
  workflow_name: string
  status: string
  created_at: string
  completed_at: string | null
  total_duration: number | null
  chain: Array<{
    department: string
    dept_id: string
    status: string
    duration: number | null
    output?: string
    error?: string
  }>
  step_outputs: StepOutput[]
  input_data: TaskRequest
}

export interface HistoryTask {
  task_id: string
  title: string
  task_type: string
  workflow_key: string
  workflow_name: string
  status: string
  created_at: string
  completed_at: string | null
  total_duration: number | null
  archived: number
  input_data: TaskRequest
}

export interface DepartmentInfo {
  name: string
  description: string
}

export interface WorkflowInfo {
  name: string
  description: string
  chain: string[]
}

export interface FCCConfig {
  departments: Record<string, DepartmentInfo>
  workflows: Record<string, WorkflowInfo>
  model: string
  max_tokens: number
  temperature: number
  version: string
}

// --- API Functions ---

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options)
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`API ${res.status}: ${detail}`)
  }
  return res.json()
}

export async function runTask(req: TaskRequest): Promise<TaskResponse> {
  return apiFetch<TaskResponse>("/api/tasks/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  return apiFetch<TaskStatus>(`/api/tasks/${taskId}/status`)
}

export async function getTaskOutput(taskId: string): Promise<TaskOutput> {
  return apiFetch<TaskOutput>(`/api/tasks/${taskId}/output`)
}

export async function getTaskTrace(taskId: string): Promise<TaskTrace> {
  return apiFetch<TaskTrace>(`/api/tasks/${taskId}/trace`)
}

export async function getTaskHistory(includeArchived: boolean = false): Promise<{ tasks: HistoryTask[] }> {
  return apiFetch<{ tasks: HistoryTask[] }>(`/api/tasks/history?include_archived=${includeArchived}`)
}

export async function archiveTask(taskId: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/tasks/${taskId}/archive`, { method: "POST" })
}

export async function unarchiveTask(taskId: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/tasks/${taskId}/unarchive`, { method: "POST" })
}

export async function getConfig(): Promise<FCCConfig> {
  return apiFetch<FCCConfig>("/api/config")
}

export async function healthCheck(): Promise<{ status: string; version: string; api_key_configured: boolean }> {
  return apiFetch("/api/health")
}
