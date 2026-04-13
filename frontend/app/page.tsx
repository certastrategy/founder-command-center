"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Terminal, Clock, Layers, Settings, Play, Trash2, Upload, Copy,
  Download, RotateCcw, Archive, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Loader2, Circle, AlertTriangle,
  Eye, EyeOff, RefreshCw,
} from "lucide-react"
import {
  runTask, getTaskStatus, getTaskOutput, getTaskTrace, getTaskHistory,
  getConfig, healthCheck, archiveTask, unarchiveTask,
  type TaskRequest, type TaskStatus, type TaskOutput,
  type HistoryTask, type StepOutput, type FCCConfig,
} from "@/lib/api"

type View = "command" | "history" | "trace" | "settings"

const TASK_TYPES = [
  { value: "auto", label: "Auto-Detect" },
  { value: "financing_deck", label: "Financing Deck" },
  { value: "website_strategy", label: "Website Strategy" },
  { value: "proposal", label: "Proposal" },
  { value: "project_definition", label: "Project Definition" },
]

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed": return <CheckCircle2 size={16} className="text-fcc-success" />
    case "failed": return <XCircle size={16} className="text-fcc-error" />
    case "running": return <Loader2 size={16} className="text-fcc-accent animate-spin" />
    default: return <Circle size={14} className="text-fcc-muted" />
  }
}

function SeverityBadge({ text }: { text: string }) {
  if (text.includes("CRITICAL")) return <span className="text-fcc-error font-semibold">CRITICAL</span>
  if (text.includes("HIGH")) return <span className="text-orange-400 font-semibold">HIGH</span>
  if (text.includes("MEDIUM")) return <span className="text-fcc-warning font-semibold">MEDIUM</span>
  if (text.includes("LOW")) return <span className="text-fcc-accent font-semibold">LOW</span>
  return null
}

export default function FounderCommandCenter() {
  const [view, setView] = useState<View>("command")
  const [fccConfig, setFccConfig] = useState<FCCConfig | null>(null)
  const [backendOnline, setBackendOnline] = useState(false)
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)

  // Task form state
  const [form, setForm] = useState<TaskRequest>({
    title: "",
    task_type: "auto",
    background: "",
    goal: "",
    constraints: "",
    desired_outputs: "",
  })

  // Running task state
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [taskOutput, setTaskOutput] = useState<TaskOutput | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [outputTab, setOutputTab] = useState<"final" | "summaries" | "audit" | "trace">("final")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // History & trace
  const [history, setHistory] = useState<HistoryTask[]>([])
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [showArchived, setShowArchived] = useState(false)

  // History detail view
  const [historyDetail, setHistoryDetail] = useState<{
    task: HistoryTask
    output: TaskOutput | null
  } | null>(null)

  // Check backend on mount
  useEffect(() => {
    healthCheck()
      .then((h) => {
        setBackendOnline(true)
        setApiKeyConfigured(h.api_key_configured)
        return getConfig()
      })
      .then((c) => setFccConfig(c))
      .catch(() => setBackendOnline(false))
  }, [])

  // Restore task from localStorage on mount
  useEffect(() => {
    const savedTaskId = localStorage.getItem("fcc_taskId")
    if (savedTaskId) {
      setTaskId(savedTaskId)
      // Attempt to restore status and output from backend
      getTaskStatus(savedTaskId)
        .then((status) => {
          setTimeout(() => {
            setTaskStatus(status)
          }, 0)
          if (status.status === "completed" || status.status === "failed") {
            return getTaskOutput(savedTaskId).then((output) => {
              setTimeout(() => {
                setTaskOutput(output)
                setOutputTab("final")
              }, 0)
            })
          } else if (status.status === "running" || status.status === "queued") {
            // Resume polling
            setIsRunning(true)
            pollRef.current = setInterval(() => pollStatus(savedTaskId), 2000)
          }
        })
        .catch(() => {
          // Backend may have restarted, clear stale taskId
          localStorage.removeItem("fcc_taskId")
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll task status
  const pollStatus = useCallback(async (id: string) => {
    try {
      const status = await getTaskStatus(id)
      // Defer state updates to next microtask to avoid React DOM reconciliation conflicts
      setTimeout(() => {
        setTaskStatus(status)
      }, 0)

      if (status.status === "completed" || status.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null

        setTimeout(() => {
          setIsRunning(false)
          if (status.status === "failed" && status.error) {
            setErrorMsg(status.error)
          }
        }, 0)

        const output = await getTaskOutput(id)
        setTimeout(() => {
          setTaskOutput(output)
          setOutputTab("final")
        }, 0)

        getTaskHistory(showArchived).then((h) => setHistory(h.tasks)).catch(() => {})
      }
    } catch (e) {
      console.error("Poll error:", e)
    }
  }, [showArchived])

  const handleRunTask = async () => {
    if (!form.title.trim()) return
    setIsRunning(true)
    setTaskOutput(null)
    setTaskStatus(null)
    setExpandedSteps(new Set())
    setErrorMsg(null)

    try {
      const result = await runTask(form)
      setTaskId(result.task_id)
      // Persist taskId so it survives browser refresh
      localStorage.setItem("fcc_taskId", result.task_id)

      pollRef.current = setInterval(() => pollStatus(result.task_id), 2000)
      setTimeout(() => pollStatus(result.task_id), 500)
    } catch (e: any) {
      setIsRunning(false)
      const msg = e?.message || String(e)
      if (msg.includes("ANTHROPIC_API_KEY")) {
        setErrorMsg("API key not configured. Add ANTHROPIC_API_KEY to your .env file and restart the backend.")
      } else {
        setErrorMsg(`Failed to start task: ${msg}`)
      }
    }
  }

  const handleClear = () => {
    setForm({ title: "", task_type: "auto", background: "", goal: "", constraints: "", desired_outputs: "" })
    setTaskId(null)
    setTaskStatus(null)
    setTaskOutput(null)
    setIsRunning(false)
    setErrorMsg(null)
    // Clear persisted taskId
    localStorage.removeItem("fcc_taskId")
    if (pollRef.current) clearInterval(pollRef.current)
  }

  // Re-run with same input: backfill form fields from input_data
  const handleReRunWithInput = (inputData: TaskRequest) => {
    setForm(inputData)
    setView("command")
    // Auto-run after a tick to let state settle
    setTimeout(async () => {
      setIsRunning(true)
      setTaskOutput(null)
      setTaskStatus(null)
      setExpandedSteps(new Set())
      setErrorMsg(null)
      try {
        const result = await runTask(inputData)
        setTaskId(result.task_id)
        localStorage.setItem("fcc_taskId", result.task_id)
        pollRef.current = setInterval(() => pollStatus(result.task_id), 2000)
        setTimeout(() => pollStatus(result.task_id), 500)
      } catch (e: any) {
        setIsRunning(false)
        setErrorMsg(`Failed to start task: ${e?.message || String(e)}`)
      }
    }, 100)
  }

  // Retry a failed task with original input
  const handleRetry = (inputData: TaskRequest) => {
    handleReRunWithInput(inputData)
  }

  const toggleStep = (i: number) => {
    const next = new Set(expandedSteps)
    next.has(i) ? next.delete(i) : next.add(i)
    setExpandedSteps(next)
  }

  // Load history on view switch or archive toggle
  const loadHistory = useCallback(() => {
    getTaskHistory(showArchived).then((h) => setHistory(h.tasks)).catch(() => {})
  }, [showArchived])

  useEffect(() => {
    if (view === "history") {
      loadHistory()
    }
  }, [view, loadHistory])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Handle clicking a history row to view details
  const handleHistoryRowClick = async (task: HistoryTask) => {
    try {
      const output = await getTaskOutput(task.task_id)
      setHistoryDetail({ task, output })
    } catch {
      setHistoryDetail({ task, output: null })
    }
  }

  // Handle archive/unarchive
  const handleArchive = async (taskId: string, currentlyArchived: number) => {
    try {
      if (currentlyArchived) {
        await unarchiveTask(taskId)
      } else {
        await archiveTask(taskId)
      }
      loadHistory()
      if (historyDetail?.task.task_id === taskId) {
        setHistoryDetail(null)
      }
    } catch (e) {
      console.error("Archive error:", e)
    }
  }

  // Download complete report as .md
  const handleDownloadReport = (task: HistoryTask | null, output: TaskOutput | null) => {
    if (!task || !output) return
    const lines: string[] = []
    lines.push(`# ${task.title} — Complete Report`)
    lines.push("")
    lines.push(`**Task ID:** ${task.task_id}`)
    lines.push(`**Task Type:** ${task.task_type}`)
    lines.push(`**Workflow:** ${task.workflow_name || task.workflow_key}`)
    lines.push(`**Status:** ${task.status}`)
    lines.push(`**Created:** ${task.created_at ? new Date(task.created_at).toLocaleString() : "-"}`)
    if (task.completed_at) lines.push(`**Completed:** ${new Date(task.completed_at).toLocaleString()}`)
    if (task.total_duration) lines.push(`**Total Duration:** ${task.total_duration.toFixed(1)}s`)
    lines.push("")
    lines.push("---")
    lines.push("")

    // Final Output
    lines.push("## Final Integrated Output")
    lines.push("")
    lines.push(output.final_output || "(No final output)")
    lines.push("")
    lines.push("---")
    lines.push("")

    // Department Outputs
    lines.push("## Department Outputs")
    lines.push("")
    output.step_outputs.forEach((step, i) => {
      lines.push(`### Step ${i + 1}: ${step.department} (${step.duration}s)`)
      lines.push("")
      lines.push(step.output)
      lines.push("")
    })

    // Audit section
    const audit = output.step_outputs.find(
      (s) => s.dept_id === "audit_red_team" || s.department.toLowerCase().includes("audit")
    )
    if (audit) {
      lines.push("---")
      lines.push("")
      lines.push("## Audit & Red Team Review")
      lines.push("")
      lines.push(audit.output)
      lines.push("")
    }

    lines.push("---")
    lines.push(`*Generated by Founder Command Center V1.1*`)

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `fcc-report-${task.task_id}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const navItems: { icon: typeof Terminal; view: View; label: string }[] = [
    { icon: Terminal, view: "command", label: "Command" },
    { icon: Clock, view: "history", label: "History" },
    { icon: Layers, view: "trace", label: "Trace" },
    { icon: Settings, view: "settings", label: "Settings" },
  ]

  const canRun = !isRunning && form.title.trim() && backendOnline && apiKeyConfigured

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-14 bg-fcc-surface border-r border-fcc-border flex flex-col items-center py-4 shrink-0">
        {navItems.map(({ icon: Icon, view: v, label }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            title={label}
            className={`w-10 h-10 flex items-center justify-center rounded-md mb-2 transition-colors ${
              view === v
                ? "bg-fcc-accent/10 text-fcc-accent border-l-2 border-fcc-accent"
                : "text-fcc-muted hover:text-fcc-text hover:bg-fcc-bg"
            }`}
          >
            <Icon size={20} />
          </button>
        ))}
        <div className="mt-auto flex flex-col items-center">
          <div className={`w-2 h-2 rounded-full ${backendOnline ? "bg-fcc-success" : "bg-fcc-error"}`}
            title={backendOnline ? "Backend online" : "Backend offline"} />
          <p className="text-[9px] text-fcc-muted mt-2 text-center leading-tight">FCC<br/>V1.1</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">

        {/* --- COMMAND VIEW --- */}
        {view === "command" && (
          <div className="flex h-full">

            {/* Left: Task Input */}
            <div className="w-80 bg-fcc-surface border-r border-fcc-border p-4 overflow-y-auto shrink-0">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Terminal size={16} className="text-fcc-accent" /> Task Input
              </h2>

              <label className="block text-xs text-fcc-muted mb-1">Task Title *</label>
              <input type="text"
                placeholder="e.g., Pre-Seed Financing Deck for CertaStrategy"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm mb-3 placeholder:text-fcc-muted/50 focus:outline-none focus:border-fcc-accent"
              />

              <label className="block text-xs text-fcc-muted mb-1">Task Type</label>
              <select
                value={form.task_type}
                onChange={(e) => setForm({ ...form, task_type: e.target.value })}
                className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:border-fcc-accent"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <label className="block text-xs text-fcc-muted mb-1">Background</label>
              <textarea rows={3}
                placeholder="Context about your company, product, or project..."
                value={form.background}
                onChange={(e) => setForm({ ...form, background: e.target.value })}
                className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm mb-3 placeholder:text-fcc-muted/50 resize-none focus:outline-none focus:border-fcc-accent"
              />

              <label className="block text-xs text-fcc-muted mb-1">Goal</label>
              <textarea rows={3}
                placeholder="What do you want to achieve with this task?"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm mb-3 placeholder:text-fcc-muted/50 resize-none focus:outline-none focus:border-fcc-accent"
              />

              <label className="block text-xs text-fcc-muted mb-1">Constraints</label>
              <textarea rows={2}
                placeholder="Any limitations, budgets, timelines..."
                value={form.constraints}
                onChange={(e) => setForm({ ...form, constraints: e.target.value })}
                className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm mb-3 placeholder:text-fcc-muted/50 resize-none focus:outline-none focus:border-fcc-accent"
              />

              <label className="block text-xs text-fcc-muted mb-1">Desired Outputs</label>
              <textarea rows={2}
                placeholder="What deliverables do you need?"
                value={form.desired_outputs}
                onChange={(e) => setForm({ ...form, desired_outputs: e.target.value })}
                className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm mb-3 placeholder:text-fcc-muted/50 resize-none focus:outline-none focus:border-fcc-accent"
              />

              <button onClick={handleRunTask} disabled={!canRun}
                className="w-full bg-fcc-accent text-white py-2.5 rounded-md text-sm font-medium mb-2 hover:bg-fcc-accent/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {isRunning ? "Running..." : "Run Task"}
              </button>

              <div className="flex gap-2">
                <button onClick={handleClear}
                  className="flex-1 bg-fcc-bg border border-fcc-border py-2 rounded-md text-sm text-fcc-muted hover:text-fcc-text transition-colors">
                  Clear
                </button>
              </div>

              {/* Status messages */}
              {!backendOnline && (
                <div className="mt-3 p-2.5 bg-fcc-error/10 border border-fcc-error/30 rounded-md text-xs text-fcc-error">
                  <strong>Backend offline.</strong> Start the API server:
                  <code className="block mt-1 bg-fcc-bg rounded px-2 py-1">python api/server.py</code>
                </div>
              )}
              {backendOnline && !apiKeyConfigured && (
                <div className="mt-3 p-2.5 bg-fcc-warning/10 border border-fcc-warning/30 rounded-md text-xs text-fcc-warning">
                  <strong>API key not set.</strong> Add your Anthropic key to <code>.env</code> and restart the backend.
                </div>
              )}
              {errorMsg && (
                <div className="mt-3 p-2.5 bg-fcc-error/10 border border-fcc-error/30 rounded-md text-xs text-fcc-error">
                  <strong>Error:</strong> {errorMsg}
                </div>
              )}
            </div>

            {/* Center: Workflow Pipeline */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-sm font-semibold">Workflow Pipeline</h2>
                {taskStatus?.workflow_name && (
                  <span className="text-xs bg-fcc-accent/10 text-fcc-accent px-2 py-0.5 rounded">
                    {taskStatus.workflow_name}
                  </span>
                )}
                {taskStatus?.workflow_key && !taskStatus.workflow_name && (
                  <span className="text-xs bg-fcc-accent/10 text-fcc-accent px-2 py-0.5 rounded">
                    {taskStatus.workflow_key.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              {!taskStatus ? (
                <div className="flex flex-col items-center justify-center h-64 text-fcc-muted text-sm">
                  <Terminal size={32} className="mb-3 opacity-20" />
                  <p>No active workflow</p>
                  <p className="text-xs mt-1">Enter a task and click Run to see the pipeline</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {taskStatus.steps.map((step, i) => (
                    <div key={i}>
                      <button onClick={() => toggleStep(i)}
                        className="w-full flex items-center gap-3 p-3 bg-fcc-surface border border-fcc-border rounded-md hover:border-fcc-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <StatusIcon status={step.status} />
                          <span className="text-sm truncate">{step.department}</span>
                          <span className="text-[10px] text-fcc-muted/50">Step {i + 1}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {step.duration != null && (
                            <span className="text-xs text-fcc-muted">{step.duration}s</span>
                          )}
                          {step.status === "running" && (
                            <span className="text-xs text-fcc-accent animate-pulse-dot">executing</span>
                          )}
                          {taskOutput?.step_outputs?.[i] && (
                            expandedSteps.has(i)
                              ? <ChevronDown size={14} className="text-fcc-muted" />
                              : <ChevronRight size={14} className="text-fcc-muted" />
                          )}
                        </div>
                      </button>
                      {expandedSteps.has(i) && taskOutput?.step_outputs?.[i] && (
                        <div className="ml-8 mt-1 mb-2 p-3 bg-fcc-bg border border-fcc-border rounded-md text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                          {taskOutput.step_outputs[i].output}
                        </div>
                      )}
                      {i < taskStatus.steps.length - 1 && (
                        <div className="flex justify-center py-0.5">
                          <div className="w-px h-3 bg-fcc-border" />
                        </div>
                      )}
                    </div>
                  ))}

                  {taskStatus.status === "completed" && taskStatus.total_duration != null && (
                    <div className="mt-4 p-3 bg-fcc-success/10 border border-fcc-success/30 rounded-md text-sm text-fcc-success flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      Workflow completed in {taskStatus.total_duration.toFixed(1)}s
                    </div>
                  )}
                  {taskStatus.status === "failed" && (
                    <div className="mt-4 p-3 bg-fcc-error/10 border border-fcc-error/30 rounded-md text-sm text-fcc-error">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle size={16} />
                        Failed: {taskStatus.error || "Unknown error"}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Output Panel */}
            <div className="w-[440px] border-l border-fcc-border flex flex-col shrink-0">
              {/* Tab bar */}
              <div className="flex border-b border-fcc-border shrink-0">
                {(["final", "summaries", "audit", "trace"] as const).map((tab) => (
                  <button key={tab} onClick={() => setOutputTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                      outputTab === tab
                        ? "text-fcc-accent border-b-2 border-fcc-accent"
                        : "text-fcc-muted hover:text-fcc-text"
                    }`}
                  >
                    {tab === "final" ? "Final Output"
                      : tab === "summaries" ? "Dept Summaries"
                      : tab === "audit" ? "Audit"
                      : "Raw Trace"}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-4">
                {!taskOutput ? (
                  <div className="flex flex-col items-center justify-center h-full text-fcc-muted text-sm">
                    <Archive size={32} className="mb-3 opacity-20" />
                    <p>Run a task to see output here</p>
                  </div>
                ) : outputTab === "final" ? (
                  <div className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                    {taskOutput.final_output || <span className="text-fcc-muted">No final output available.</span>}
                  </div>
                ) : outputTab === "summaries" ? (
                  <div className="space-y-2">
                    {taskOutput.step_outputs.map((step, i) => (
                      <details key={i} className="group">
                        <summary className="flex items-center gap-2 p-2 bg-fcc-surface border border-fcc-border rounded-md cursor-pointer text-sm hover:border-fcc-muted/50">
                          <CheckCircle2 size={14} className="text-fcc-success shrink-0" />
                          <span className="flex-1">{step.department}</span>
                          <span className="text-xs text-fcc-muted">{step.duration}s</span>
                        </summary>
                        <div className="mt-1 p-3 bg-fcc-bg border border-fcc-border rounded-md text-xs font-mono whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
                          {step.output}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : outputTab === "audit" ? (
                  <div className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                    {(() => {
                      const audit = taskOutput.step_outputs.find(
                        (s) => s.dept_id === "audit_red_team" || s.department.toLowerCase().includes("audit")
                      )
                      if (!audit) return <p className="text-fcc-muted">No audit output found.</p>
                      return audit.output.split("\n").map((line, i) => {
                        const hasSeverity = /CRITICAL|HIGH|MEDIUM|LOW/.test(line)
                        return (
                          <div key={i} className={hasSeverity ? "my-1" : ""}>
                            {hasSeverity ? (
                              <span>
                                {line.split(/(CRITICAL|HIGH|MEDIUM|LOW)/).map((part, j) =>
                                  ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(part)
                                    ? <SeverityBadge key={j} text={part} />
                                    : <span key={j}>{part}</span>
                                )}
                              </span>
                            ) : line}
                          </div>
                        )
                      })
                    })()}
                  </div>
                ) : (
                  <pre className="text-xs font-mono whitespace-pre-wrap text-fcc-muted leading-relaxed">
                    {JSON.stringify(taskOutput, null, 2)}
                  </pre>
                )}
              </div>

              {/* Action bar */}
              {taskOutput && (
                <div className="flex items-center gap-1 p-2 border-t border-fcc-border shrink-0">
                  <button onClick={() => navigator.clipboard.writeText(taskOutput.final_output)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-fcc-muted hover:text-fcc-text rounded transition-colors" title="Copy final output">
                    <Copy size={12} /> Copy
                  </button>
                  <button onClick={() => {
                    // Full report download from command view
                    if (taskId && taskStatus) {
                      const taskObj: HistoryTask = {
                        task_id: taskId,
                        title: form.title,
                        task_type: form.task_type,
                        workflow_key: taskStatus.workflow_key,
                        workflow_name: taskStatus.workflow_name,
                        status: taskStatus.status,
                        created_at: "",
                        completed_at: null,
                        total_duration: taskStatus.total_duration,
                        archived: 0,
                        input_data: form,
                      }
                      handleDownloadReport(taskObj, taskOutput)
                    }
                  }}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-fcc-muted hover:text-fcc-text rounded transition-colors" title="Download complete report">
                    <Download size={12} /> Report
                  </button>
                  <button onClick={handleRunTask} disabled={isRunning}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-fcc-muted hover:text-fcc-text rounded disabled:opacity-50 transition-colors" title="Re-run task">
                    <RotateCcw size={12} /> Re-run
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- HISTORY VIEW --- */}
        {view === "history" && (
          <div className="flex h-full">
            {/* History list */}
            <div className={`${historyDetail ? "w-1/2 border-r border-fcc-border" : "flex-1"} p-6 overflow-y-auto`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Clock size={16} className="text-fcc-accent" /> Task History
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowArchived(!showArchived)
                      // loadHistory will be triggered by the useEffect
                    }}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                      showArchived
                        ? "bg-fcc-accent/10 text-fcc-accent"
                        : "text-fcc-muted hover:text-fcc-text"
                    }`}
                    title={showArchived ? "Hide archived tasks" : "Show archived tasks"}
                  >
                    {showArchived ? <Eye size={12} /> : <EyeOff size={12} />}
                    {showArchived ? "Showing archived" : "Archived hidden"}
                  </button>
                  <button onClick={loadHistory}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-fcc-muted hover:text-fcc-text rounded transition-colors"
                    title="Refresh">
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>
              {history.length === 0 ? (
                <p className="text-fcc-muted text-sm">No tasks yet. Run a task from the Command view.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-fcc-border text-fcc-muted text-xs text-left">
                      <th className="py-2 px-3">Run ID</th>
                      <th className="py-2 px-3">Title</th>
                      <th className="py-2 px-3">Workflow</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((t) => (
                      <tr
                        key={t.task_id}
                        onClick={() => handleHistoryRowClick(t)}
                        className={`border-b border-fcc-border/50 hover:bg-fcc-surface/50 cursor-pointer ${
                          historyDetail?.task.task_id === t.task_id ? "bg-fcc-accent/5" : ""
                        } ${t.archived ? "opacity-60" : ""}`}
                      >
                        <td className="py-2 px-3 font-mono text-xs">{t.task_id}</td>
                        <td className="py-2 px-3">
                          {t.title}
                          {t.archived ? <span className="ml-1 text-[10px] text-fcc-muted">(archived)</span> : null}
                        </td>
                        <td className="py-2 px-3 text-fcc-muted text-xs">{t.workflow_name || t.workflow_key?.replace(/_/g, " ") || t.task_type}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                            t.status === "completed" ? "bg-fcc-success/10 text-fcc-success"
                              : t.status === "failed" ? "bg-fcc-error/10 text-fcc-error"
                              : "bg-fcc-accent/10 text-fcc-accent"
                          }`}>
                            <StatusIcon status={t.status} />
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-fcc-muted text-xs">
                          {t.total_duration ? `${t.total_duration.toFixed(1)}s` : "-"}
                        </td>
                        <td className="py-2 px-3 text-fcc-muted text-xs">
                          {t.created_at ? new Date(t.created_at).toLocaleString() : "-"}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {/* Re-run button */}
                            {t.input_data && t.input_data.title && (
                              <button
                                onClick={() => handleReRunWithInput(t.input_data)}
                                className="p-1 text-fcc-muted hover:text-fcc-accent rounded transition-colors"
                                title="Re-run with same input"
                              >
                                <RotateCcw size={12} />
                              </button>
                            )}
                            {/* Retry button for failed tasks */}
                            {t.status === "failed" && t.input_data && t.input_data.title && (
                              <button
                                onClick={() => handleRetry(t.input_data)}
                                className="p-1 text-fcc-error hover:text-fcc-error/80 rounded transition-colors"
                                title="Retry failed task"
                              >
                                <RefreshCw size={12} />
                              </button>
                            )}
                            {/* Archive/Unarchive button */}
                            <button
                              onClick={() => handleArchive(t.task_id, t.archived)}
                              className="p-1 text-fcc-muted hover:text-fcc-warning rounded transition-colors"
                              title={t.archived ? "Unarchive" : "Archive"}
                            >
                              <Archive size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* History detail panel */}
            {historyDetail && (
              <div className="w-1/2 flex flex-col overflow-hidden">
                {/* Detail header */}
                <div className="p-4 border-b border-fcc-border shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">{historyDetail.task.title}</h3>
                    <button
                      onClick={() => setHistoryDetail(null)}
                      className="text-fcc-muted hover:text-fcc-text text-xs"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-fcc-muted">
                    <span>ID: <span className="font-mono">{historyDetail.task.task_id}</span></span>
                    <span>Type: {historyDetail.task.task_type}</span>
                    <span>Status: <span className={
                      historyDetail.task.status === "completed" ? "text-fcc-success"
                        : historyDetail.task.status === "failed" ? "text-fcc-error"
                        : "text-fcc-accent"
                    }>{historyDetail.task.status}</span></span>
                    {historyDetail.task.created_at && (
                      <span>Created: {new Date(historyDetail.task.created_at).toLocaleString()}</span>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3">
                    {historyDetail.output && (
                      <>
                        <button
                          onClick={() => handleDownloadReport(historyDetail.task, historyDetail.output)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-fcc-bg border border-fcc-border rounded hover:border-fcc-accent transition-colors"
                        >
                          <Download size={12} /> Download Report
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(historyDetail.output?.final_output || "")}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-fcc-bg border border-fcc-border rounded hover:border-fcc-accent transition-colors"
                        >
                          <Copy size={12} /> Copy Output
                        </button>
                      </>
                    )}
                    {historyDetail.task.input_data && historyDetail.task.input_data.title && (
                      <button
                        onClick={() => {
                          setForm(historyDetail.task.input_data)
                          setView("command")
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-fcc-bg border border-fcc-border rounded hover:border-fcc-accent transition-colors"
                      >
                        <RotateCcw size={12} /> Fill Form
                      </button>
                    )}
                    {historyDetail.task.status === "failed" && historyDetail.task.input_data?.title && (
                      <button
                        onClick={() => handleRetry(historyDetail.task.input_data)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-fcc-error/10 border border-fcc-error/30 text-fcc-error rounded hover:bg-fcc-error/20 transition-colors"
                      >
                        <RefreshCw size={12} /> Retry
                      </button>
                    )}
                  </div>
                </div>
                {/* Detail output */}
                <div className="flex-1 overflow-y-auto p-4">
                  {historyDetail.output ? (
                    <div className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                      {historyDetail.output.final_output || <span className="text-fcc-muted">No final output available.</span>}
                    </div>
                  ) : (
                    <p className="text-fcc-muted text-sm">
                      {historyDetail.task.status === "running" || historyDetail.task.status === "queued"
                        ? "Task is still running..."
                        : "No output available for this task."}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TRACE VIEW --- */}
        {view === "trace" && (
          <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Layers size={16} className="text-fcc-accent" /> Department Trace
            </h2>
            {!taskOutput ? (
              <p className="text-fcc-muted text-sm">Run a task first, then view the department trace here.</p>
            ) : (
              <div className="space-y-3">
                {taskOutput.step_outputs.map((step, i) => (
                  <details key={i} className="group">
                    <summary className="flex items-center gap-3 p-3 bg-fcc-surface border border-fcc-border rounded-md cursor-pointer hover:border-fcc-muted/50">
                      <div className="w-8 h-8 bg-fcc-accent/10 rounded-md flex items-center justify-center text-fcc-accent text-xs font-mono">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{step.department}</p>
                        <p className="text-xs text-fcc-muted mt-0.5 truncate max-w-xl">
                          {step.output.substring(0, 200)}...
                        </p>
                      </div>
                      <span className="text-xs text-fcc-muted shrink-0">{step.duration}s</span>
                    </summary>
                    <div className="mt-1 p-4 bg-fcc-bg border border-fcc-border rounded-md text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                      {step.output}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- SETTINGS VIEW --- */}
        {view === "settings" && (
          <div className="p-6 max-w-lg">
            <h2 className="text-sm font-semibold mb-6 flex items-center gap-2">
              <Settings size={16} className="text-fcc-accent" /> Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-fcc-muted mb-1">Backend Status</label>
                <div className={`flex items-center gap-2 text-sm ${backendOnline ? "text-fcc-success" : "text-fcc-error"}`}>
                  <div className={`w-2 h-2 rounded-full ${backendOnline ? "bg-fcc-success" : "bg-fcc-error"}`} />
                  {backendOnline ? "Connected" : "Offline"}
                </div>
              </div>
              <div>
                <label className="block text-xs text-fcc-muted mb-1">API Key</label>
                <div className={`flex items-center gap-2 text-sm ${apiKeyConfigured ? "text-fcc-success" : "text-fcc-warning"}`}>
                  <div className={`w-2 h-2 rounded-full ${apiKeyConfigured ? "bg-fcc-success" : "bg-fcc-warning"}`} />
                  {apiKeyConfigured ? "Configured" : "Not set \u2014 add ANTHROPIC_API_KEY to .env"}
                </div>
              </div>
              <div>
                <label className="block text-xs text-fcc-muted mb-1">Model</label>
                <input type="text" value={fccConfig?.model || "-"} disabled
                  className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm font-mono text-fcc-muted" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-fcc-muted mb-1">Max Tokens</label>
                  <input type="text" value={fccConfig?.max_tokens || "-"} disabled
                    className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm font-mono text-fcc-muted" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-fcc-muted mb-1">Temperature</label>
                  <input type="text" value={fccConfig?.temperature || "-"} disabled
                    className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm font-mono text-fcc-muted" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-fcc-muted mb-1">Version</label>
                <input type="text" value={fccConfig?.version || "-"} disabled
                  className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm text-fcc-muted" />
              </div>
              {fccConfig?.workflows && (
                <div>
                  <label className="block text-xs text-fcc-muted mb-2">Available Workflows</label>
                  <div className="space-y-2">
                    {Object.entries(fccConfig.workflows).map(([key, wf]) => (
                      <div key={key} className="p-2 bg-fcc-bg border border-fcc-border rounded-md">
                        <p className="text-xs font-medium">{wf.name}</p>
                        <p className="text-[10px] text-fcc-muted mt-0.5">
                          {wf.chain.map((d) => fccConfig.departments[d]?.name || d).join(" \u2192 ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
