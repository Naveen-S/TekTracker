"use client";

/**
 * Admin "Claude analysis" settings (claude-connector-analysis.md decisions 13–14): the on/off
 * switch, which models users may pick (+ the default), effort, and the per-run $ budget and
 * wall-clock timeout the user's connector enforces. Takes `run`/`busy` from AdminPanel (the
 * SprintCapacityConfig idiom) so saves ride the page's toast-on-success / inline-error convention.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { ANALYSIS_EFFORTS } from "@/lib/connector/defaults.mjs";

function parseModels(text) {
  return [...new Set(text.split(",").map((model) => model.trim()).filter(Boolean))];
}

export function AnalysisSettingsConfig({ settings, run, busy }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [modelsText, setModelsText] = useState(settings.allowedModels.join(", "));
  const [defaultModel, setDefaultModel] = useState(settings.defaultModel);
  const [effort, setEffort] = useState(settings.effort);
  const [budget, setBudget] = useState(String(settings.maxBudgetUsd));
  const [timeout, setTimeoutMinutes] = useState(String(settings.timeoutMinutes));

  const models = parseModels(modelsText);
  const effectiveDefault = models.includes(defaultModel) ? defaultModel : (models[0] ?? "");

  const save = (event) => {
    event.preventDefault();
    run("Save Claude analysis settings", () =>
      apiFetch("/api/analysis-settings", {
        method: "PUT",
        body: {
          enabled,
          allowedModels: models,
          defaultModel: effectiveDefault,
          effort,
          maxBudgetUsd: Number(budget),
          timeoutMinutes: Number(timeout),
        },
      }),
    );
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="analysis-enabled"
          checked={enabled}
          disabled={busy}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <label htmlFor="analysis-enabled" className="cursor-pointer text-sm font-medium">
          Enable “Analyse with Claude” for everyone
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="analysis-models">Allowed models</Label>
          <Input
            id="analysis-models"
            value={modelsText}
            disabled={busy}
            onChange={(event) => setModelsText(event.target.value)}
            placeholder="opus, sonnet"
          />
          <p className="text-[11px] text-muted-foreground">Claude Code model aliases or ids, comma-separated.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="analysis-default-model">Default model</Label>
          <Select
            id="analysis-default-model"
            value={effectiveDefault}
            disabled={busy || models.length === 0}
            onChange={(event) => setDefaultModel(event.target.value)}
          >
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="analysis-effort">Effort</Label>
          <Select id="analysis-effort" value={effort} disabled={busy} onChange={(event) => setEffort(event.target.value)}>
            {ANALYSIS_EFFORTS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="analysis-budget">Max $ per analysis</Label>
            <Input
              id="analysis-budget"
              type="number"
              min="0.1"
              max="50"
              step="0.1"
              value={budget}
              disabled={busy}
              onChange={(event) => setBudget(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="analysis-timeout">Timeout (min)</Label>
            <Input
              id="analysis-timeout"
              type="number"
              min="1"
              max="60"
              step="1"
              value={timeout}
              disabled={busy}
              onChange={(event) => setTimeoutMinutes(event.target.value)}
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Analyses run on each user’s own Claude Code subscription; the budget is Claude Code’s notional list-price
        cap per run (`--max-budget-usd`), enforced on their machine.
      </p>
      <div>
        <Button type="submit" disabled={busy || models.length === 0}>
          Save
        </Button>
      </div>
    </form>
  );
}
