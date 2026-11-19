export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface DocumentItem {
  id: string;
  file_name: string;
  storage_path: string;
  file_type?: string;
  file_size_bytes: number;
  file_hash?: string | null;
  processing_status: ProcessingStatus;
  total_pages?: number | null;
  chunks_count: number;
  vehicle_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface VehicleItem {
  id: string;
  manufacturer: string;
  model_name: string;
}

export interface DashboardStats {
  totalDocuments: number;
  completedDocuments: number;
  processingDocuments: number;
  availableVehicles: number;
}

export interface SystemHealth {
  appStatus: "online" | "offline" | "checking";
  dbStatus: "connected" | "disconnected" | "checking";
  latencyMs?: number | null;
}

export interface DocumentUploadResult {
  success: boolean;
  document_id: string | null;
  file_name: string;
  storage_path: string;
  file_size_bytes: number;
  file_hash?: string | null;
  is_duplicate: boolean;
  total_pages: number;
  processing_status: ProcessingStatus;
  message: string;
}

export interface ChunkPreviewItem {
  chunk_index: number;
  page_number: number;
  char_count: number;
  content_preview: string;
}

export interface ProcessDocumentResult {
  success: boolean;
  document_id: string;
  file_name: string;
  processing_status: string;
  total_pages: number;
  chunks_created: number;
  embeddings_stored: number;
  embedding_dimension: number;
  sample_chunks: ChunkPreviewItem[];
  message: string;
}

export interface DocumentChunkItem {
  id: string;
  document_id: string;
  chunk_index: number;
  page_number: number;
  content: string;
  metadata: Record<string, any>;
  created_at?: string;
}



export interface ChatSourceItem {
  document_name: string;
  document_id: string;
  page_number?: number | null;
  similarity: number;
  excerpt: string;
  chunk_id?: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: ChatSourceItem[];
  confidence_score?: number | null;
  chunks_retrieved?: number;
  is_fallback?: boolean;
  status?: "accepted" | "rejected" | string;
  isRejected?: boolean;
  created_at: string;
  isError?: boolean;
}

export interface ChatAskRequest {
  question: string;
  session_id?: string | null;
  vehicle_id?: string | null;
  top_k?: number;
  similarity_threshold?: number;
  model?: string | null;
}

export interface ChatAskResponse {
  success: boolean;
  status?: "accepted" | "rejected" | string;
  question: string;
  answer: string;
  session_id?: string | null;
  sources: ChatSourceItem[];
  chunks_retrieved: number;
  confidence_score?: number | null;
  is_fallback?: boolean;
  message: string;
}


export interface VehicleSpecData {
  name: string;
  identified: boolean;
  variant?: string | null;
  document_name?: string | null;
  engine_transmission: string;
  fuel_type: string;
  mileage: string;
  dimensions: string;
  seating_capacity: string;
  safety_features: string;
  infotainment_comfort: string;
  price: string;
}

export interface ComparisonRowItem {
  attribute: string;
  vehicle_1_value: string;
  vehicle_2_value: string;
  difference?: string | null;
}

export interface VehicleCompareRequest {
  vehicle_1: string;
  vehicle_2: string;
  variant_1?: string | null;
  variant_2?: string | null;
  comparison_criteria?: string | null;
  model?: string | null;
}

export interface VehicleCompareResponse {
  success: boolean;
  vehicle_1: VehicleSpecData;
  vehicle_2: VehicleSpecData;
  comparison_table: ComparisonRowItem[];
  summary: string;
  sources: ChatSourceItem[];
  message: string;
}

export interface AvailableVehicleOption {
  id: string;
  name: string;
  document_name: string;
  total_pages?: number | null;
  processing_status: string;
}
