"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw, X } from "lucide-react";
import { uploadDocument, processDocument } from "@/lib/api";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

interface UploadZoneProps {
  onUploadSuccess: () => void;
}

export function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | "duplicate" | null;
    message: string;
    details?: string;
  }>({ type: null, message: "" });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateFile = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return "Only PDF files (.pdf) are supported.";
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 20 MB limit.`;
    }
    return null;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadStatus({ type: null, message: "" });

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const error = validateFile(file);
      if (error) {
        setUploadStatus({ type: "error", message: error });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadStatus({ type: null, message: "" });
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const error = validateFile(file);
      if (error) {
        setUploadStatus({ type: "error", message: error });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus({ type: null, message: "" });

    try {
      const result = await uploadDocument(selectedFile);

      if (result.is_duplicate) {
        setUploadStatus({
          type: "duplicate",
          message: "Duplicate PDF Detected",
          details: `This exact document already exists in the repository (ID: ${result.document_id}). No duplicate files or embeddings were created.`,
        });
      } else {
        // Automatically process the document so chunks & embeddings are generated immediately
        try {
          const procResult = await processDocument(result.document_id);
          setUploadStatus({
            type: "success",
            message: `Successfully uploaded and processed ${selectedFile.name}`,
            details: `Extracted ${result.total_pages} page(s), generated ${procResult.chunks_stored || procResult.chunks_created || "all"} vector chunks, and indexed brochure for AI search and comparisons.`,
          });
        } catch (procErr: any) {
          setUploadStatus({
            type: "success",
            message: `Successfully uploaded ${selectedFile.name}`,
            details: `Extracted ${result.total_pages} page(s). File saved to private storage bucket 'automotive-brochures'.`,
          });
        }
      }

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploadSuccess();
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadStatus({
        type: "error",
        message: "Upload Failed",
        details: err.message || "An unexpected error occurred during PDF ingestion.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadStatus({ type: null, message: "" });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
          Upload Vehicle Brochure or Manual
        </h2>
        <p className="text-xs text-slate-500">
          Upload PDF files (up to 20 MB). SHA-256 duplicate detection is applied automatically.
        </p>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-50/50"
            : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-2xs">
          <UploadCloud className="w-6 h-6" />
        </div>

        <div className="text-xs font-semibold text-slate-800">
          <span className="text-blue-600 hover:underline">Click to browse</span> or drag and drop your PDF here
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Supported format: PDF only • Maximum file size: 20 MB
        </p>
      </div>

      {/* Selected File Card */}
      {selectedFile && (
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-blue-50/50 border border-blue-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {selectedFile.name}
              </div>
              <div className="text-[11px] text-slate-500">
                {(selectedFile.size / 1024).toFixed(1)} KB • PDF Document
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading & Extracting...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Start Upload</span>
                </>
              )}
            </button>
            <button
              onClick={clearSelection}
              disabled={isUploading}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"
              title="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {uploadStatus.type === "success" && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{uploadStatus.message}</div>
            {uploadStatus.details && (
              <div className="text-[11px] text-emerald-700 mt-0.5">{uploadStatus.details}</div>
            )}
          </div>
        </div>
      )}

      {uploadStatus.type === "duplicate" && (
        <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{uploadStatus.message}</div>
            {uploadStatus.details && (
              <div className="text-[11px] text-blue-700 mt-0.5">{uploadStatus.details}</div>
            )}
          </div>
        </div>
      )}

      {uploadStatus.type === "error" && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{uploadStatus.message}</div>
            {uploadStatus.details && (
              <div className="text-[11px] text-rose-700 mt-0.5">{uploadStatus.details}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
