import {
  DocumentItem,
  VehicleItem,
  DashboardStats,
  SystemHealth,
  ChatAskRequest,
  ChatAskResponse,
  VehicleCompareRequest,
  VehicleCompareResponse,
  AvailableVehicleOption,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchDashboardData(): Promise<{
  stats: DashboardStats;
  recentDocuments: DocumentItem[];
  health: SystemHealth;
}> {
  let documents: DocumentItem[] = [];
  let availableVehicles = 0;
  let health: SystemHealth = {
    appStatus: "checking",
    dbStatus: "checking",
    latencyMs: null,
  };

  // 1. Check System Health
  try {
    const healthRes = await fetch(`${API_BASE_URL}/api/v1/health`, { cache: "no-store" });
    if (healthRes.ok) {
      health.appStatus = "online";
    } else {
      health.appStatus = "offline";
    }
  } catch {
    health.appStatus = "offline";
  }

  try {
    const dbRes = await fetch(`${API_BASE_URL}/api/v1/health/database`, { cache: "no-store" });
    if (dbRes.ok) {
      const dbData = await dbRes.json();
      health.dbStatus = dbData.status === "connected" ? "connected" : "disconnected";
      health.latencyMs = dbData.latency_ms ?? null;
    } else {
      health.dbStatus = "disconnected";
    }
  } catch {
    health.dbStatus = "disconnected";
  }

  // 2. Fetch Documents
  try {
    const docsRes = await fetch(`${API_BASE_URL}/api/v1/documents`, {
      cache: "no-store",
    });

    if (docsRes.ok) {
      const data = await docsRes.json();
      documents = data.documents || [];
    } else {
      // Fallback: try public vehicles endpoint which returns document summaries
      const fallbackRes = await fetch(`${API_BASE_URL}/api/v1/vehicles/`, { cache: "no-store" });
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        availableVehicles = fbData.vehicles_count || 0;
        documents = (fbData.documents || []).map((d: any) => ({
          id: d.id,
          file_name: d.file_name,
          storage_path: `brochures/${d.file_name}`,
          file_size_bytes: 0,
          processing_status: d.processing_status || "completed",
          total_pages: d.total_pages,
          chunks_count: 0,
          created_at: null,
        }));
      }
    }
  } catch (err) {
    console.warn("Could not fetch documents from admin list, trying vehicles endpoint:", err);
    try {
      const fallbackRes = await fetch(`${API_BASE_URL}/api/v1/vehicles/`, { cache: "no-store" });
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        availableVehicles = fbData.vehicles_count || 0;
        documents = (fbData.documents || []).map((d: any) => ({
          id: d.id,
          file_name: d.file_name,
          storage_path: `brochures/${d.file_name}`,
          file_size_bytes: 0,
          processing_status: d.processing_status || "completed",
          total_pages: d.total_pages,
          chunks_count: 0,
          created_at: null,
        }));
      }
    } catch (fbErr) {
      console.error("All document fetch attempts failed:", fbErr);
    }
  }

  // 3. Fetch Vehicles count if not already populated
  if (availableVehicles === 0) {
    try {
      const vRes = await fetch(`${API_BASE_URL}/api/v1/vehicles/`, { cache: "no-store" });
      if (vRes.ok) {
        const vData = await vRes.json();
        availableVehicles = vData.vehicles_count || 0;
      }
    } catch {
      // ignore
    }
  }

  // Compute Stats
  const totalDocuments = documents.length;
  const completedDocuments = documents.filter((d) => d.processing_status === "completed").length;
  const processingDocuments = documents.filter(
    (d) => d.processing_status === "processing" || d.processing_status === "pending"
  ).length;

  return {
    stats: {
      totalDocuments,
      completedDocuments,
      processingDocuments,
      availableVehicles,
    },
    recentDocuments: documents.slice(0, 5),
    health,
  };
}

export async function fetchDocumentsList(): Promise<DocumentItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/documents`, {
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return data.documents || [];
    }

    // Fallback: vehicles endpoint returns document list
    const fbRes = await fetch(`${API_BASE_URL}/api/v1/vehicles/`, { cache: "no-store" });
    if (fbRes.ok) {
      const fbData = await fbRes.json();
      return (fbData.documents || []).map((d: any) => ({
        id: d.id,
        file_name: d.file_name,
        storage_path: d.storage_path || d.file_name,
        file_size_bytes: d.file_size || 0,
        processing_status: d.processing_status || "completed",
        total_pages: d.total_pages,
        chunks_count: 0,
        created_at: d.created_at || null,
      }));
    }

    throw new Error(`Failed to load documents: HTTP ${res.status}`);
  } catch (err: any) {
    console.error("fetchDocumentsList error:", err);
    throw err;
  }
}

export async function uploadDocument(file: File, vehicleId?: string): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  if (vehicleId) {
    formData.append("vehicle_id", vehicleId);
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/documents/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || `Upload failed with status ${res.status}`);
  }

  return data;
}

export async function fetchDocumentDetails(documentId: string): Promise<DocumentItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/documents/${documentId}`, {
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || `Failed to fetch document: HTTP ${res.status}`);
  }

  return data;
}

export async function processDocument(
  documentId: string,
  options?: { target_chunk_size?: number; chunk_overlap?: number }
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/documents/${documentId}/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options || {}),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || `Processing failed with status ${res.status}`);
  }

  return data;
}

export async function fetchDocumentChunks(documentId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/documents/${documentId}/chunks?limit=50`, {
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || `Failed to fetch chunks: HTTP ${res.status}`);
  }

  return data;
}


export async function askChatMessage(request: ChatAskRequest): Promise<ChatAskResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/chat/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || `Query failed with status ${res.status}`);
  }

  return data;
}

export async function fetchChatSessionMessages(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}/messages`, {
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || `Failed to fetch session messages: HTTP ${res.status}`);
  }

  return data;
}


// Known vehicle model to manufacturer mapping for brochures named only by model (e.g. "harrier.pdf" -> "Tata Harrier")
const MODEL_MANUFACTURER_MAP: Record<string, string> = {
  // Tata
  harrier: "Tata Harrier",
  safari: "Tata Safari",
  nexon: "Tata Nexon",
  punch: "Tata Punch",
  altroz: "Tata Altroz",
  tiago: "Tata Tiago",
  tigor: "Tata Tigor",
  curvv: "Tata Curvv",
  // Hyundai
  alcazar: "Hyundai Alcazar",
  bayon: "Hyundai Bayon",
  creta: "Hyundai Creta",
  verna: "Hyundai Verna",
  venue: "Hyundai Venue",
  "i20-n-line": "Hyundai i20 N Line",
  i20: "Hyundai i20",
  "grand-i10": "Hyundai Grand i10 Nios",
  nios: "Hyundai Grand i10 Nios",
  aura: "Hyundai Aura",
  tucson: "Hyundai Tucson",
  exter: "Hyundai Exter",
  ioniq: "Hyundai Ioniq 5",
  kona: "Hyundai Kona Electric",
  // Mahindra
  xuv700: "Mahindra XUV700",
  xuv300: "Mahindra XUV 3XO",
  xuv3xo: "Mahindra XUV 3XO",
  scorpio: "Mahindra Scorpio-N",
  thar: "Mahindra Thar",
  bolero: "Mahindra Bolero",
  // Kia
  seltos: "Kia Seltos",
  sonet: "Kia Sonet",
  carens: "Kia Carens",
  ev6: "Kia EV6",
  // Maruti Suzuki
  brezza: "Maruti Brezza",
  baleno: "Maruti Baleno",
  swift: "Maruti Swift",
  fronx: "Maruti Fronx",
  // Toyota
  fortuner: "Toyota Fortuner",
  hyryder: "Toyota Urban Cruiser Hyryder",
  innova: "Toyota Innova Hycross",
  // Honda
  city: "Honda City",
  elevate: "Honda Elevate",
  amaze: "Honda Amaze",
  // MG
  hector: "MG Hector",
  astor: "MG Astor",
  // Skoda / VW
  kushaq: "Skoda Kushaq",
  slavia: "Skoda Slavia",
  taigun: "Volkswagen Taigun",
  virtus: "Volkswagen Virtus",
};

export function formatBrochureVehicleName(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "");
  const lower = base.toLowerCase();

  // 1. Check if model matches known lookup
  for (const [key, fullName] of Object.entries(MODEL_MANUFACTURER_MAP)) {
    if (lower.includes(key)) {
      return fullName;
    }
  }

  // 2. Generic dynamic formatting: strip file separators and document noise words
  const cleaned = base
    .replace(/[-_]/g, " ")
    .replace(/digitalbrochure|brochure|master|specification|specsheet|catalog|manual|guide/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Capitalize each token
  const titled = cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return titled || base;
}

export async function fetchAvailableVehicles(): Promise<AvailableVehicleOption[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/vehicles/`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Failed to load vehicles: HTTP ${res.status}`);
    }

    const data = await res.json();
    const docs = data.documents || [];
    const vehicles = data.vehicles || [];

    // Filter documents to successfully completed ones
    const completedDocs = docs.filter(
      (d: any) => (d.processing_status || "").toLowerCase() === "completed"
    );

    const vehicleOptions: AvailableVehicleOption[] = completedDocs.map((doc: any) => ({
      id: doc.id,
      name: formatBrochureVehicleName(doc.file_name),
      document_name: doc.file_name,
      total_pages: doc.total_pages,
      processing_status: doc.processing_status || "completed",
    }));

    // If vehicles table has entries, map them too if not already present
    for (const v of vehicles) {
      const vName = `${v.manufacturer} ${v.model_name}`.trim();
      const exists = vehicleOptions.some(
        (opt) => opt.name.toLowerCase() === vName.toLowerCase()
      );
      if (!exists) {
        vehicleOptions.push({
          id: v.id,
          name: vName,
          document_name: "Database Record",
          processing_status: "completed",
        });
      }
    }

    return vehicleOptions;
  } catch (err: any) {
    console.error("fetchAvailableVehicles error:", err);
    throw err;
  }
}

export async function compareVehicles(
  request: VehicleCompareRequest
): Promise<VehicleCompareResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/vehicles/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || `Comparison failed with status ${res.status}`);
  }

  return data;
}
