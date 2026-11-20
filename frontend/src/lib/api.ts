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
  UserProfile,
  ChatSessionItem,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

let currentAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("cyepro_auth_token", token);
    } else {
      localStorage.removeItem("cyepro_auth_token");
    }
  }
}

export function getAuthToken(): string | null {
  if (currentAuthToken) return currentAuthToken;
  if (typeof window !== "undefined") {
    currentAuthToken = localStorage.getItem("cyepro_auth_token");
  }
  return currentAuthToken;
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export function handleAuthResponse(res: Response) {
  if (res.status === 401) {
    setAuthToken(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cyepro:unauthorized"));
    }
  }
}

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------

export async function loginUser(email: string, password: string):Promise<{
  success: boolean;
  message: string;
  access_token: string;
  refresh_token?: string;
  user_id: string;
  email: string;
  full_name: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Authentication failed.");
  }
  setAuthToken(data.access_token);
  return data;
}

export async function signupUser(
  fullName: string,
  email: string,
  password: string,
  confirmPassword: string
): Promise<{
  success: boolean;
  message: string;
  user_id?: string;
  email?: string;
  email_confirmed?: boolean;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: fullName,
      email,
      password,
      confirm_password: confirmPassword,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Signup failed.");
  }
  return data;
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to process forgot password request.");
  }
  return data;
}

export async function resetPassword(newPassword: string, confirmPassword: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to reset password.");
  }
  return data;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No active session token");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  if (res.status === 401) {
    handleAuthResponse(res);
    throw new Error("Session expired. Please log in again.");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to authenticate session.");
  }
  return data;
}

export async function updateUserProfile(fullName: string): Promise<{ success: boolean; message: string; full_name: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/profile`, {
    method: "PATCH",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ full_name: fullName }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to update profile.");
  }
  return data;
}

// ----------------------------------------------------
// Dashboard & System Health API
// ----------------------------------------------------

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
    health.appStatus = healthRes.ok ? "online" : "offline";
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
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (docsRes.ok) {
      const data = await docsRes.json();
      documents = data.documents || [];
    } else {
      // Fallback: vehicles endpoint returns document summaries
      const fallbackRes = await fetch(`${API_BASE_URL}/api/v1/vehicles/`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
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
    console.warn("Could not fetch documents list, trying vehicles fallback:", err);
  }

  // 3. Fetch Vehicles count if not already populated
  if (availableVehicles === 0) {
    try {
      const vRes = await fetch(`${API_BASE_URL}/api/v1/vehicles/`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
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

// ----------------------------------------------------
// Documents API
// ----------------------------------------------------

export async function fetchDocumentsList(): Promise<DocumentItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/documents`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  if (res.status === 401) {
    handleAuthResponse(res);
    return [];
  }

  if (res.ok) {
    const data = await res.json();
    return data.documents || [];
  }

  // Fallback: vehicles endpoint returns document list
  const fbRes = await fetch(`${API_BASE_URL}/api/v1/vehicles/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
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
      is_owner: false,
    }));
  }

  const errData = await res.json().catch(() => ({}));
  throw new Error(errData.detail || `Failed to load documents: HTTP ${res.status}`);
}

export async function uploadDocument(file: File, vehicleId?: string): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  if (vehicleId) {
    formData.append("vehicle_id", vehicleId);
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/documents/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
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
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to fetch chunks: HTTP ${res.status}`);
  }
  return data;
}

export async function getDocumentDownloadUrl(documentId: string): Promise<{ download_url: string; file_name: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/documents/${documentId}/download`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to get download link: HTTP ${res.status}`);
  }
  return data;
}

export async function deleteDocument(documentId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/documents/${documentId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to delete document: HTTP ${res.status}`);
  }
  return data;
}

// ----------------------------------------------------
// Chat & Sessions API
// ----------------------------------------------------

export async function askChatMessage(request: ChatAskRequest): Promise<ChatAskResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/chat/ask`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(request),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Query failed with status ${res.status}`);
  }
  return data;
}

export async function fetchChatSessions(): Promise<ChatSessionItem[]> {
  const token = getAuthToken();
  if (!token) return [];

  const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  if (res.status === 401) {
    handleAuthResponse(res);
    return [];
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to fetch sessions: HTTP ${res.status}`);
  }
  return data.sessions || [];
}

export async function fetchChatSessionMessages(sessionId: string): Promise<any> {
  const token = getAuthToken();
  if (!token) return { messages: [] };

  const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}/messages`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  if (res.status === 401) {
    handleAuthResponse(res);
    return { messages: [] };
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to fetch session messages: HTTP ${res.status}`);
  }
  return data;
}

export async function deleteChatSession(sessionId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to delete session: HTTP ${res.status}`);
  }
  return data;
}

// ----------------------------------------------------
// Vehicles & Comparison API
// ----------------------------------------------------

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

  for (const [key, fullName] of Object.entries(MODEL_MANUFACTURER_MAP)) {
    if (lower.includes(key)) {
      return fullName;
    }
  }

  const cleaned = base
    .replace(/[-_]/g, " ")
    .replace(/digitalbrochure|brochure|master|specification|specsheet|catalog|manual|guide/gi, "")
    .replace(/\s+/g, " ")
    .trim();

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
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Failed to load vehicles: HTTP ${res.status}`);
    }

    const data = await res.json();
    const docs = data.documents || [];
    const vehicles = data.vehicles || [];

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
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(request),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Comparison failed with status ${res.status}`);
  }
  return data;
}
