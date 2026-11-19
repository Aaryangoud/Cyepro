"use client";

import React, { useState } from "react";
import {
  Car,
  GitCompare,
  ArrowRightLeft,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { AvailableVehicleOption } from "@/lib/types";

interface VehicleSelectorProps {
  vehicles: AvailableVehicleOption[];
  vehicle1: string;
  vehicle2: string;
  variant1: string;
  variant2: string;
  criteria: string;
  isLoading: boolean;
  onVehicle1Change: (val: string) => void;
  onVehicle2Change: (val: string) => void;
  onVariant1Change: (val: string) => void;
  onVariant2Change: (val: string) => void;
  onCriteriaChange: (val: string) => void;
  onCompare: () => void;
  onSwap: () => void;
}

const CRITERIA_PRESETS = [
  "Family & 3-Row Usability",
  "Highway & City Fuel Efficiency",
  "ADAS & Cabin Safety Features",
  "Engine Power & Turbo Powertrain",
];

export function VehicleSelector({
  vehicles,
  vehicle1,
  vehicle2,
  variant1,
  variant2,
  criteria,
  isLoading,
  onVehicle1Change,
  onVehicle2Change,
  onVariant1Change,
  onVariant2Change,
  onCriteriaChange,
  onCompare,
  onSwap,
}: VehicleSelectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isSameVehicle = Boolean(vehicle1 && vehicle2 && vehicle1 === vehicle2);
  const canCompare = Boolean(vehicle1 && vehicle2 && !isSameVehicle && !isLoading);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-7">
      {/* Selector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-4 items-center">
        {/* Vehicle 1 Selection Box */}
        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs font-semibold text-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">
                1
              </span>
              First Vehicle
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              Official Brochure Source
            </span>
          </label>

          <div className="relative">
            <select
              value={vehicle1}
              onChange={(e) => onVehicle1Change(e.target.value)}
              className="w-full pl-3.5 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer transition-colors"
            >
              <option value="">Select first vehicle...</option>
              {vehicles.map((v) => (
                <option
                  key={`v1-${v.id}`}
                  value={v.name}
                  disabled={v.name === vehicle2}
                >
                  {v.name} ({v.document_name}
                  {v.total_pages ? ` • ${v.total_pages} pgs` : ""})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Optional Variant Input 1 */}
          {showAdvanced && (
            <div className="pt-1">
              <input
                type="text"
                value={variant1}
                onChange={(e) => onVariant1Change(e.target.value)}
                placeholder="Optional trim/variant (e.g., SX(O), Signature)"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Swap Action Icon */}
        <div className="flex justify-center pt-5 sm:pt-6">
          <button
            onClick={onSwap}
            type="button"
            disabled={!vehicle1 || !vehicle2}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            title="Swap vehicles"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Vehicle 2 Selection Box */}
        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs font-semibold text-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-bold">
                2
              </span>
              Second Vehicle
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              Official Brochure Source
            </span>
          </label>

          <div className="relative">
            <select
              value={vehicle2}
              onChange={(e) => onVehicle2Change(e.target.value)}
              className="w-full pl-3.5 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer transition-colors"
            >
              <option value="">Select second vehicle...</option>
              {vehicles.map((v) => (
                <option
                  key={`v2-${v.id}`}
                  value={v.name}
                  disabled={v.name === vehicle1}
                >
                  {v.name} ({v.document_name}
                  {v.total_pages ? ` • ${v.total_pages} pgs` : ""})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Optional Variant Input 2 */}
          {showAdvanced && (
            <div className="pt-1">
              <input
                type="text"
                value={variant2}
                onChange={(e) => onVariant2Change(e.target.value)}
                placeholder="Optional trim/variant (e.g., Premium, N Line)"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Duplicate Selection Warning */}
      {isSameVehicle && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Please select two different vehicles to generate a comparative analysis.
          </span>
        </div>
      )}

      {/* Advanced Criteria Toggle & Inputs */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{showAdvanced ? "Hide Trims & Criteria" : "Custom Trims & Criteria"}</span>
        </button>

        {/* Quick Criteria Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 hidden md:inline">Focus on:</span>
          {CRITERIA_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onCriteriaChange(criteria === p ? "" : p)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                criteria === p
                  ? "bg-blue-50 text-blue-700 border-blue-300 font-semibold"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Specific Comparison Focus / Use-Case
          </label>
          <input
            type="text"
            value={criteria}
            onChange={(e) => onCriteriaChange(e.target.value)}
            placeholder="e.g., Highway road trips, boot space comparison, safety for elderly parents..."
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      )}

      {/* Primary Action Button */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <FileText className="w-4 h-4 text-slate-400" />
          <span>
            Specifications extracted strictly from uploaded Supabase brochure chunks
          </span>
        </div>

        <button
          onClick={onCompare}
          disabled={!canCompare}
          type="button"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing Brochures...</span>
            </>
          ) : (
            <>
              <GitCompare className="w-4 h-4" />
              <span>Compare Vehicles</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
