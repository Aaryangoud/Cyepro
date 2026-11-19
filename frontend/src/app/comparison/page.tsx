"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  GitCompare,
  Layers,
  FileText,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { VehicleSelector } from "@/components/comparison/VehicleSelector";
import { ComparisonTable } from "@/components/comparison/ComparisonTable";
import { ComparisonSummary } from "@/components/comparison/ComparisonSummary";
import { ComparisonSources } from "@/components/comparison/ComparisonSources";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  fetchAvailableVehicles,
  compareVehicles,
  fetchDashboardData,
} from "@/lib/api";
import {
  AvailableVehicleOption,
  VehicleCompareResponse,
  SystemHealth,
} from "@/lib/types";

export default function ComparisonPage() {
  const [vehicles, setVehicles] = useState<AvailableVehicleOption[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState<boolean>(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);

  // Selector state
  const [vehicle1, setVehicle1] = useState<string>("");
  const [vehicle2, setVehicle2] = useState<string>("");
  const [variant1, setVariant1] = useState<string>("");
  const [variant2, setVariant2] = useState<string>("");
  const [criteria, setCriteria] = useState<string>("");

  // Comparison execution state
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] =
    useState<VehicleCompareResponse | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  // System health
  const [health, setHealth] = useState<SystemHealth>({
    appStatus: "checking",
    dbStatus: "checking",
  });

  const loadVehicles = useCallback(async () => {
    setIsLoadingVehicles(true);
    setVehicleError(null);
    try {
      const [vehiclesData, dashData] = await Promise.allSettled([
        fetchAvailableVehicles(),
        fetchDashboardData(),
      ]);

      if (vehiclesData.status === "fulfilled") {
        setVehicles(vehiclesData.value);

        // Pre-select first two if available and none selected yet
        if (vehiclesData.value.length >= 2) {
          setVehicle1((prev) => prev || vehiclesData.value[0].name);
          setVehicle2((prev) => prev || vehiclesData.value[1].name);
        } else if (vehiclesData.value.length === 1) {
          setVehicle1((prev) => prev || vehiclesData.value[0].name);
        }
      } else {
        throw vehiclesData.reason;
      }

      if (dashData.status === "fulfilled") {
        setHealth(dashData.value.health);
      }
    } catch (err: any) {
      console.error("Failed to load vehicle brochures:", err);
      setVehicleError(
        err.message || "Failed to load vehicles from database. Is backend running?"
      );
    } finally {
      setIsLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handleSwap = () => {
    const tempV = vehicle1;
    const tempVar = variant1;
    setVehicle1(vehicle2);
    setVariant1(variant2);
    setVehicle2(tempV);
    setVariant2(tempVar);
  };

  const handleCompare = async () => {
    if (!vehicle1 || !vehicle2 || vehicle1 === vehicle2 || isComparing) return;

    setIsComparing(true);
    setCompareError(null);
    try {
      const result = await compareVehicles({
        vehicle_1: vehicle1,
        vehicle_2: vehicle2,
        variant_1: variant1.trim() || undefined,
        variant_2: variant2.trim() || undefined,
        comparison_criteria: criteria.trim() || undefined,
      });

      setComparisonResult(result);
    } catch (err: any) {
      console.error("Vehicle comparison failed:", err);
      setCompareError(
        err.message ||
          "An error occurred while generating the side-by-side vehicle comparison."
      );
    } finally {
      setIsComparing(false);
    }
  };

  const handleReset = () => {
    setComparisonResult(null);
    setCompareError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Sticky Top Navigation */}
        <TopNav
          health={health}
          title="Vehicle Comparison Matrix"
          subtitle="Side-by-side technical evaluation strictly grounded in official brochure specifications"
        />

        {/* Workspace Container */}
        <main className="flex-1 p-5 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Brochure-Grounded Vehicle Comparison
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Compare powertrains, dimensions, safety equipment, and comfort features across verified PDF brochures
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Zero-Hallucination Policy
              </span>

              {comparisonResult && (
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  New Comparison
                </button>
              )}
            </div>
          </div>

          {/* Vehicle Load Error */}
          {vehicleError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <div className="flex-1">
                <span className="font-semibold">Backend Connection Notice:</span> {vehicleError}
              </div>
              <button
                onClick={loadVehicles}
                className="px-2.5 py-1 bg-white border border-rose-300 text-rose-700 rounded-md font-medium hover:bg-rose-100 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* No Vehicles Empty State */}
          {!isLoadingVehicles && vehicles.length === 0 && !vehicleError && (
            <EmptyState
              title="No processed vehicle brochures available"
              description="To compare vehicles, at least two automotive PDF brochures must be uploaded and processed in Supabase."
              actionText="Upload Brochures"
              actionHref="/documents"
            />
          )}

          {/* Selector Section */}
          {vehicles.length > 0 && (
            <section>
              <VehicleSelector
                vehicles={vehicles}
                vehicle1={vehicle1}
                vehicle2={vehicle2}
                variant1={variant1}
                variant2={variant2}
                criteria={criteria}
                isLoading={isComparing}
                onVehicle1Change={(v) => {
                  setVehicle1(v);
                  setComparisonResult(null);
                }}
                onVehicle2Change={(v) => {
                  setVehicle2(v);
                  setComparisonResult(null);
                }}
                onVariant1Change={setVariant1}
                onVariant2Change={setVariant2}
                onCriteriaChange={setCriteria}
                onCompare={handleCompare}
                onSwap={handleSwap}
              />
            </section>
          )}

          {/* Compare Error Banner */}
          {compareError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-bold">Comparison Error</p>
                <p>{compareError}</p>
              </div>
              <button
                onClick={handleCompare}
                className="px-3 py-1 bg-white border border-rose-300 text-rose-700 font-semibold rounded-lg hover:bg-rose-100 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Comparison Results Section */}
          {comparisonResult && (
            <section className="space-y-6">
              {/* Side-by-Side Matrix Table with Trade-Offs & Specific Focus */}
              <ComparisonTable
                vehicle1={comparisonResult.vehicle_1}
                vehicle2={comparisonResult.vehicle_2}
                rows={comparisonResult.comparison_table}
              />

              {/* Verified Sources Accordion */}
              <ComparisonSources sources={comparisonResult.sources} />
            </section>
          )}

          {/* Pre-Comparison Guidance Card */}
          {!comparisonResult && !isComparing && vehicles.length >= 2 && (
            <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-sm text-center max-w-2xl mx-auto my-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-3">
                <GitCompare className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Ready to Compare Specifications
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                Select any two vehicles from your uploaded brochures above and click{" "}
                <span className="font-semibold text-slate-700">&ldquo;Compare Vehicles&rdquo;</span>.
                Specifications are extracted strictly from brochure text chunks with zero hallucination.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
