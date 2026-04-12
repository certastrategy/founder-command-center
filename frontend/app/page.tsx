"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Terminal, Clock, Layers, Settings, Play, Trash2, Upload, Copy,
  Download, RotateCcw, Archive, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Loader2, Circle, AlertTriangle,
} from "lucide-react"
import {
  runTask, getTaskStatus, getTaskOutput, getTaskTrace, getTaskHistory,
  getConfig, healthCheck,
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
    title: "", task_type: "auto", background: "", goal: "", constraints: "", desired_outputs: "",
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

  // Poll task status
  const pollStatus = useCallback(async (id: string) => {
    try {
      const status = await getTaskStatus(id)
      setTaskStatus(status)

      if (status.status === "completed" || status.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        setIsRunning(false)

        if (status.status === "failed" && status.error) {
          setErrorMsg(status.error)
        }

        const output = await getTaskOutput(id)
        setTaskOutput(output)
        setOutputTab("final")

        getTaskHistory().then((h) => setHistory(h.tasks)).catch(() => {})
      }
    } catch (e) {
      console.error("Poll error:", e)
    }
  }, [])

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
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const toggleStep = (i: number) => {
    const next = new Set(expandedSteps)
    next.has(i) ? next.delete(i) : next.add(i)
    setExpandedSteps(next)
  }

  // Load history on view switch
  useEffect(() => {
    if (view === "history") {
      getTaskHistory().then((h) => setHistory(h.tasks)).catch(() => {})
    }
  }, [view])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

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
          <div
            className={`w-2 h-2 rounded-full ${backendOnline ? "bg-fcc-success" : "bg-fcc-error"}`}
            title={backendOnline ? "Backend online" : "Backend offline"}
          />
          <p className="text-[9px] text-fcc-muted mt-2 text-center leading-tight">FCC<br/>V1.1</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">

        {/* âââ COMMAND VIEW âââ */}
        {view === "command" && (
          <div className="flex h-full">
            {/* Left: Task Input */}
            <div className="w-80 bg-fcc-surface border-r border-fcc-border p-4 overflow-y-auto shrink-0">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Terminal size={16} className="text-fcc-accent" />
                Task Input
              </h2>

              <label className="block text-xs text-fcc-muted mb-1">Task Title *</label>
              <input
                type="text"
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
              <textarea
                rows={3}
                placeholder="Context about your company, product, or project..."
                value={form.background}
                onChange={(e) => setForm({ ...form, background: e.target.value })}
                className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm mb-3 placeholder:text-fcc-muted/50 resize-none focus:outline-none focus:border-fcc-accent"
              />

              <label className="block text-xs text-fcc-muted mb-1">Goal</label>
              <textarea
                rows={3}
                placeholder="What do you want to achieve with this task?"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm mb-3 placeholder:text-fcc-muted/50 resize-none focus:outline-none focus:border-fcc-accent"
              />

              <label className="block text-xs text-fcc-muted mb-1">Constraints</label>
              <textarea
                rows={2}
                placeholder="Any limitations, budgets, timelines..."
                value={form.constraints}
                onChange={(e) => setForm({ ...form, constraints: e.target.value })}
                className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm mb-3 placeholder:text-fcc-muted/50 resize-none focus:outline-none focus:border-fcc-accent"
              />

              <label className="block text-xs text-fcc-muted mb-1">Desired Outputs</label>
              <textarea
                rows={2}
                placeholder="What deliverables do you need?"
                value={form.desired_outputs}
                onChange={(e) => setForm({ ...form, desired_outputs: e.target.value })}
                className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm mb-3 placeholder:text-fcc-muted/50 resize-none focus:outline-none focus:border-fcc-accent"
              />

              <button
                onClick={handleRunTask}
                disabled={!canRun}
                className="w-full bg-fcc-accent text-white py-2.5 rounded-md text-sm font-medium mb-2 hover:bg-fcc-accent/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {isRunning ? "Running..." : "Run Task"}
              </button>

              <div className="flex gap-2">
                <button onClick={handleClear} className="flex-1 bg-fcc-bg border border-fcc-border py-2 rounded-md text-sm text-fcc-muted hover:text-fcc-text transition-colors">
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
                      <button
                        onClick={() => toggleStep(i)}
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
                    <div className="mt-4 p-3 bg-fcc-error/10 border border-fcc-error/30 rounded-md text-sm text-fcc-error flex items-center gap-2">
                      <XCircle size={16} />
                      Failed: {taskStatus.error || "Unknown error"}
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
                  <button
                    key={tab}
                    onClick={() => setOutputTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                      outputTab === tab
                        ? "text-fcc-accent border-b-2 border-fcc-accent"
                        : "text-fcc-muted hover:text-fcc-text"
                    }`}
                  >
                    {tab === "final" ? "Final Output" : tab === "summaries" ? "Dept Summaries" : tab === "audit" ? "Audit" : "Raw Trace"}
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
                  <button
                    onClick={() => navigator.clipboard.writeText(taskOutput.final_output)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-fcc-muted hover:text-fcc-text rounded transition-colors"
                    title="Copy final output"
                  >
                    <Copy size={12} /> Copy
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([taskOutput.final_output], { type: "text/markdown" })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement("a")
                      a.href = url; a.download = `fcc-output-${taskId}.md`; a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-fcc-muted hover:text-fcc-text rounded transition-colors"
                    title="Download as markdown"
                  >
                    <Download size={12} /> .md
                  </button>
                  <button
                    onClick={handleRunTask}
                    disabled={isRunning}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-fcc-muted hover:text-fcc-text rounded disabled:opacity-50 transition-colors"
                    title="Re-run task"
                  >
                    <RotateCcw size={12} /> Re-run
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* âââ HISTORY VIEW âââ */}
        {view === "history" && (
          <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Clock size={16} className="text-fcc-accent" />
              Task History
            </h2>
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
                  </tr>
                </thead>
                <tbody>
                  {history.map((t) => (
                    <tr key={t.task_id} className="border-b border-fcc-border/50 hover:bg-fcc-surface/50">
                      <td className="py-2 px-3 font-mono text-xs">{t.task_id}</td>
                      <td className="py-2 px-3">{t.title}</td>
                      <td className="py-2 px-3 text-fcc-muted text-xs">{t.workflow_name || t.workflow_key?.replace(/_/g, " ") || t.task_type}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                          t.status === "completed" ? "bg-fcc-success/10 text-fcc-success" :
                          t.status === "failed" ? "bg-fcc-error/10 text-fcc-error" :
                          "bg-fcc-accent/10 text-fcc-accent"
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* âââ TRACE VIEW âââ */}
        {view === "trace" && (
          <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Layers size={16} className="text-fcc-accent" />
              Department Trace
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

        {/* âââ SETTINGS VIEW âââ */}
        {view === "settings" && (
          <div className="p-6 max-w-lg">
            <h2 className="text-sm font-semibold mb-6 flex items-center gap-2">
              <Settings size={16} className="text-fcc-accent" />
              Settings
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
                  {apiKeyConfigured ? "Configured" : "Not set â add ANTHROPIC_API_KEY to .env"}
                </div>
              </div>
              <div>
                <label className="block text-xs text-fcc-muted mb-1">Model</label>
                <input type="text" value={fccConfig?.model || "-"} disabled className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm font-mono text-fcc-muted" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-fcc-muted mb-1">Max Tokens</label>
                  <input type="text" value={fccConfig?.max_tokens || "-"} disabled className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm font-mono text-fcc-muted" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-fcc-muted mb-1">Temperature</label>
                  <input type="text" value={fccConfig?.temperature || "-"} disabled className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm font-mono text-fcc-muted" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-fcc-muted mb-1">Version</label>
                <input type="text" value={fccConfig?.version || "-"} disabled className="w-full bg-fcc-bg border border-fcc-border rounded-md px-3 py-2 text-sm text-fcc-muted" />
              </div>
              {fccConfig?.workflows && (
                <div>
                  <label className="block text-xs text-fcc-muted mb-2">Available Workflows</label>
                  <div className="space-y-2">
                    {Object.entries(fccConfig.workflows).map(([key, wf]) => (
                      <div key={key} className="p-2 bg-fcc-bg border border-fcc-border rounded-md">
                        <p className="text-xs font-medium">{wf.name}</p>
                        <p className="text-[10px] text-fcc-muted mt-0.5">
                          {wf.chain.map((d) => fccConfig.departments[d]?.name || d).join(" â ")}
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
