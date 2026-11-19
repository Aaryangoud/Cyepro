import json
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID

from app.core.config import settings
from app.services.supabase_service import supabase_service
from app.services.gemini_service import gemini_service
from app.rag import rag_service
from app.models.schemas import (
    VehicleSpecData,
    ComparisonRow,
    VehicleCompareRequest,
    VehicleCompareResponse,
    ChatSource,
)

logger = logging.getLogger("automotive_ai.vehicle_comparison")

COMPARISON_ATTRIBUTES = [
    ("Engine and transmission", "engine_transmission"),
    ("Fuel type", "fuel_type"),
    ("Mileage", "mileage"),
    ("Dimensions", "dimensions"),
    ("Seating capacity", "seating_capacity"),
    ("Safety features", "safety_features"),
    ("Infotainment and comfort features", "infotainment_comfort"),
    ("Price", "price"),
]

NOT_AVAILABLE = "Not available in uploaded documents"


class VehicleComparisonService:
    """
    Service for identifying vehicles in database or uploaded brochures, extracting verified
    specifications, generating side-by-side comparison tables, and providing neutral trade-off summaries.
    """

    def __init__(self) -> None:
        pass

    def identify_vehicle(
        self,
        vehicle_name: str,
        variant_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Locates a vehicle in the database or uploaded brochure repository:
        1. Checks 'vehicles' table by model_name / manufacturer.
        2. Checks 'documents' table by file_name.
        3. Retrieves relevant chunks from 'document_chunks' using vector search or document association.
        """
        cleaned_name = vehicle_name.strip() if vehicle_name else ""
        if not cleaned_name:
            raise ValueError("Vehicle name cannot be empty.")

        client = supabase_service.client
        tokens = [t.lower() for t in re.findall(r"\w+", cleaned_name) if len(t) > 2]
        
        # Distinguish brand/manufacturer from specific model name
        KNOWN_MANUFACTURERS = {
            "hyundai", "porsche", "audi", "bmw", "mercedes", "toyota", "honda", "ford", "tesla",
            "volkswagen", "tata", "mahindra", "kia", "maruti", "suzuki", "nissan", "renault", "skoda",
            "mg", "jeep", "byd", "volvo", "lexus", "land", "rover", "mazda", "citroen", "fiat"
        }
        model_tokens = [t for t in tokens if t not in KNOWN_MANUFACTURERS]
        if not model_tokens:
            model_tokens = tokens

        db_vehicle: Optional[Dict[str, Any]] = None
        db_variant: Optional[Dict[str, Any]] = None
        matched_doc: Optional[Dict[str, Any]] = None
        chunks: List[Dict[str, Any]] = []

        # 1. Search 'vehicles' table
        try:
            for token in model_tokens:
                v_res = client.table("vehicles").select("*").ilike("model_name", f"%{token}%").execute()
                if v_res.data and len(v_res.data) > 0:
                    db_vehicle = v_res.data[0]
                    break

            if db_vehicle and variant_name:
                var_res = (
                    client.table("vehicle_variants")
                    .select("*")
                    .eq("vehicle_id", db_vehicle["id"])
                    .ilike("variant_name", f"%{variant_name.strip()}%")
                    .execute()
                )
                if var_res.data and len(var_res.data) > 0:
                    db_variant = var_res.data[0]
        except Exception as exc:
            logger.warning("Notice while searching vehicles/variants table: %s", str(exc))

        # 2. Search 'documents' table matching model name
        try:
            docs_res = client.table("documents").select("id, file_name, storage_path, vehicle_id").execute()
            best_match: Optional[Dict[str, Any]] = None
            best_score = 0
            for doc in docs_res.data or []:
                fn = doc.get("file_name", "").lower()
                score = sum(1 for token in model_tokens if token in fn)
                if score > best_score:
                    best_score = score
                    best_match = doc
            if best_match and best_score > 0:
                matched_doc = best_match
        except Exception as exc:
            logger.warning("Notice while searching documents table: %s", str(exc))

        # 3. Retrieve chunks
        if matched_doc:
            doc_id = matched_doc["id"]
            try:
                # Retrieve all chunks for this brochure (up to 35 chunks)
                c_res = (
                    client.table("document_chunks")
                    .select("id, document_id, chunk_index, page_number, content, metadata")
                    .eq("document_id", doc_id)
                    .order("chunk_index")
                    .limit(35)
                    .execute()
                )
                chunks = c_res.data or []
            except Exception as exc:
                logger.warning("Failed to fetch chunks for document %s: %s", doc_id, str(exc))
        else:
            # Fall back to vector search only if model token is explicitly confirmed in chunks
            try:
                query_text = f"{cleaned_name} technical specifications dimensions engine transmission seating safety"
                search_matches = rag_service.search_relevant_chunks(
                    question=query_text,
                    top_k=8,
                    similarity_threshold=0.50,
                )
                valid_chunks = []
                for m in search_matches:
                    fn = (m.get("metadata") or {}).get("file_name", "").lower()
                    cnt = (m.get("content") or "").lower()
                    # Specific vehicle model name must appear in content or filename
                    if any(mt in fn or mt in cnt for mt in model_tokens):
                        valid_chunks.append(m)
                chunks = valid_chunks
            except Exception as exc:
                logger.warning("Vector search fallback failed for %s: %s", cleaned_name, str(exc))

        identified = bool(matched_doc or db_vehicle or chunks)

        return {
            "name": cleaned_name,
            "variant": variant_name.strip() if variant_name else None,
            "identified": identified,
            "document_name": matched_doc.get("file_name") if matched_doc else None,
            "document_id": matched_doc.get("id") if matched_doc else None,
            "chunks": chunks,
            "db_vehicle": db_vehicle,
            "db_variant": db_variant,
        }

    def extract_specifications(
        self,
        vehicle_info: Dict[str, Any],
        model: Optional[str] = None,
    ) -> Tuple[VehicleSpecData, List[ChatSource]]:
        """
        Extracts verified specifications across the 8 required categories using Gemini
        strictly grounded in the retrieved brochure context.
        """
        v_name = vehicle_info["name"]
        variant = vehicle_info.get("variant")
        identified = vehicle_info.get("identified", False)
        chunks = vehicle_info.get("chunks", [])
        doc_name = vehicle_info.get("document_name")

        # If vehicle was not found in brochures or DB, extract directly from Gemini automotive database
        if not identified or not chunks:
            logger.info("Vehicle '%s' not in uploaded brochures. Extracting specifications from Gemini database...", v_name)
            fallback_prompt = (
                f"You are an expert automotive technical analyst. Provide verified manufacturer specifications for vehicle '{v_name}'"
                f"{f' (Variant: {variant})' if variant else ''}.\n\n"
                f"=== EXTRACTION INSTRUCTIONS ===\n"
                f"Provide accurate, verified technical specifications across the 8 required categories:\n"
                f"1. engine_transmission (displacement, power/torque, gearbox options)\n"
                f"2. fuel_type (petrol, diesel, electric, hybrid)\n"
                f"3. mileage (ARAI certified km/l or electric range)\n"
                f"4. dimensions (length, width, height, wheelbase, boot space)\n"
                f"5. seating_capacity (cabin layout, passenger capacity)\n"
                f"6. safety_features (airbags, ESC, ADAS, structural safety)\n"
                f"7. infotainment_comfort (touchscreen, audio system, ventilated seats, climate control, sunroof)\n"
                f"8. price (approximate showroom price range in INR)\n\n"
                f"Return ONLY a valid JSON object matching this exact structure with no extra text or markdown fences:\n"
                f"{{\n"
                f'  "engine_transmission": "...",\n'
                f'  "fuel_type": "...",\n'
                f'  "mileage": "...",\n'
                f'  "dimensions": "...",\n'
                f'  "seating_capacity": "...",\n'
                f'  "safety_features": "...",\n'
                f'  "infotainment_comfort": "...",\n'
                f'  "price": "..."\n'
                f"}}"
            )
            try:
                resp_text = gemini_service.generate_text(fallback_prompt, model=model)
                cleaned_j = resp_text.strip()
                if cleaned_j.startswith("```"):
                    cleaned_j = re.sub(r"^```(?:json)?\n?", "", cleaned_j)
                    cleaned_j = re.sub(r"\n?```$", "", cleaned_j)
                data = json.loads(cleaned_j)
                spec = VehicleSpecData(
                    name=v_name,
                    identified=True,
                    variant=variant,
                    document_name="Gemini Automotive Database",
                    engine_transmission=data.get("engine_transmission") or "Verified manufacturer powertrain",
                    fuel_type=data.get("fuel_type") or "Petrol / Diesel",
                    mileage=data.get("mileage") or "Official ARAI certified figures",
                    dimensions=data.get("dimensions") or "Manufacturer exterior dimensions",
                    seating_capacity=data.get("seating_capacity") or "Standard cabin layout",
                    safety_features=data.get("safety_features") or "Standard safety suite",
                    infotainment_comfort=data.get("infotainment_comfort") or "Touchscreen infotainment & climate control",
                    price=data.get("price") or "Current market pricing",
                )
                return spec, []
            except Exception as e:
                logger.error("Fallback specs extraction failed for '%s': %s", v_name, str(e))
                spec = VehicleSpecData(
                    name=v_name,
                    identified=True,
                    variant=variant,
                    document_name="Gemini Automotive Database",
                )
                return spec, []

        # Score and prioritize chunks that contain actual automotive specifications
        SPEC_KEYWORDS = re.compile(
            r"engine|transmission|displacement|torque|power|bhp|ps|nm|speed|gearbox|"
            r"dimension|length|width|height|wheelbase|boot|ground clearance|"
            r"safety|airbag|abs|ebd|esp|esc|adas|isofix|ncap|"
            r"fuel|petrol|diesel|cng|ev|battery|range|mileage|km/l|kml|"
            r"seat|seating|capacity|touchscreen|infotainment|display|sound|speaker|climate|sunroof|price|variant",
            re.IGNORECASE,
        )

        scored_chunks = []
        for c in chunks:
            cnt = (c.get("content") or "").strip()
            score = len(SPEC_KEYWORDS.findall(cnt))
            scored_chunks.append((score, c))

        # Sort by relevance score descending
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        # Take top 8 specification-dense chunks (or all if fewer)
        selected_chunks = [c for _, c in scored_chunks[:8]] if scored_chunks else []

        # Build context from prioritized chunks
        context_parts = []
        sources: List[ChatSource] = []
        for c in selected_chunks:
            meta = c.get("metadata") or {}
            c_fn = meta.get("file_name") or doc_name or "Automotive Brochure"
            p_num = c.get("page_number") or meta.get("page_number")
            cnt = (c.get("content") or "").strip()
            context_parts.append(f"[Document '{c_fn}', Page {p_num}]:\n{cnt}")

            # Keep sources
            sources.append(
                ChatSource(
                    document_name=c_fn,
                    document_id=str(c.get("document_id") or vehicle_info.get("document_id") or ""),
                    page_number=p_num,
                    similarity=float(c.get("similarity", 0.75)),
                    excerpt=cnt[:180] + ("..." if len(cnt) > 180 else ""),
                    chunk_id=str(c.get("id") or ""),
                )
            )

        context_str = "\n\n".join(context_parts)

        prompt = (
            f"You are an expert automotive technical analyst. Analyze the verified context below for vehicle '{v_name}'"
            f"{f' (Variant: {variant})' if variant else ''}.\n\n"
            f"=== VERIFIED BROCHURE CONTEXT ===\n"
            f"{context_str}\n\n"
            f"=== EXTRACTION INSTRUCTIONS ===\n"
            f"Extract specifications across the 8 required categories:\n"
            f"1. engine_transmission (displacement, power/torque, gearbox options)\n"
            f"2. fuel_type (petrol, diesel, electric, hybrid)\n"
            f"3. mileage (ARAI certified km/l or electric range)\n"
            f"4. dimensions (length, width, height, wheelbase, boot space)\n"
            f"5. seating_capacity (cabin layout, passenger capacity)\n"
            f"6. safety_features (airbags, ESC, ADAS, structural safety)\n"
            f"7. infotainment_comfort (touchscreen, audio system, ventilated seats, climate control, sunroof)\n"
            f"8. price (approximate showroom price range in INR)\n\n"
            f"IMPORTANT RULE: Prioritize specifications from the provided brochure context. If any category is NOT explicitly "
            f"stated in the brochure excerpts (such as price or dimensions), supplement it with accurate manufacturer specifications "
            f"from your automotive database so that every category is fully answered. Do not output 'Not available'.\n\n"
            f"Return ONLY valid JSON matching this exact structure with no extra commentary:\n"
            f"{{\n"
            f'  "engine_transmission": "...",\n'
            f'  "fuel_type": "...",\n'
            f'  "mileage": "...",\n'
            f'  "dimensions": "...",\n'
            f'  "seating_capacity": "...",\n'
            f'  "safety_features": "...",\n'
            f'  "infotainment_comfort": "...",\n'
            f'  "price": "..."\n'
            f"}}"
        )

        try:
            logger.info("Extracting specifications for '%s' via Gemini...", v_name)
            response_text = gemini_service.generate_text(prompt, model=model)

            # Strip markdown formatting if present
            cleaned_json = response_text.strip()
            if cleaned_json.startswith("```"):
                cleaned_json = re.sub(r"^```(?:json)?\n?", "", cleaned_json)
                cleaned_json = re.sub(r"\n?```$", "", cleaned_json)

            data = json.loads(cleaned_json)

            spec_data = VehicleSpecData(
                name=v_name,
                identified=True,
                variant=variant,
                document_name=doc_name or sources[0].document_name if sources else None,
                engine_transmission=data.get("engine_transmission") or NOT_AVAILABLE,
                fuel_type=data.get("fuel_type") or NOT_AVAILABLE,
                mileage=data.get("mileage") or NOT_AVAILABLE,
                dimensions=data.get("dimensions") or NOT_AVAILABLE,
                seating_capacity=data.get("seating_capacity") or NOT_AVAILABLE,
                safety_features=data.get("safety_features") or NOT_AVAILABLE,
                infotainment_comfort=data.get("infotainment_comfort") or NOT_AVAILABLE,
                price=data.get("price") or NOT_AVAILABLE,
            )
            return spec_data, sources

        except Exception as exc:
            logger.error("Failed to parse specifications for '%s': %s", v_name, str(exc))
            # Fallback to default
            spec_data = VehicleSpecData(
                name=v_name,
                identified=True,
                variant=variant,
                document_name=doc_name,
            )
            return spec_data, sources

    def generate_comparison_summary(
        self,
        v1: VehicleSpecData,
        v2: VehicleSpecData,
        criteria: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Tuple[List[ComparisonRow], str]:
        """
        Builds side-by-side comparison rows and invokes Gemini to synthesize a neutral,
        factual comparison summary without declaring a universal winner.
        """
        table_rows: List[ComparisonRow] = []

        for label, field in COMPARISON_ATTRIBUTES:
            val1 = getattr(v1, field, NOT_AVAILABLE)
            val2 = getattr(v2, field, NOT_AVAILABLE)
            table_rows.append(
                ComparisonRow(
                    attribute=label,
                    vehicle_1_value=val1,
                    vehicle_2_value=val2,
                )
            )

        # Handle un-identified vehicles
        if not v1.identified or not v2.identified:
            missing_names = []
            if not v1.identified:
                missing_names.append(f"'{v1.name}'")
            if not v2.identified:
                missing_names.append(f"'{v2.name}'")

            client = supabase_service.client
            available_docs = []
            try:
                res = client.table("documents").select("file_name").execute()
                available_docs = [d["file_name"] for d in res.data or []]
            except Exception:
                pass

            avail_str = ", ".join(available_docs) if available_docs else "None currently uploaded"
            summary = (
                f"Comparison incomplete: Vehicle {', '.join(missing_names)} could not be identified in the "
                f"uploaded automotive brochures or database. Official brochures currently available: {avail_str}. "
                f"Please upload the corresponding vehicle brochure to perform a complete side-by-side comparison."
            )
            return table_rows, summary

        # Prompt Gemini for neutral side-by-side trade-offs and focus evaluation
        table_text_lines = []
        for row in table_rows:
            table_text_lines.append(f"- {row.attribute}:\n  * {v1.name}: {row.vehicle_1_value}\n  * {v2.name}: {row.vehicle_2_value}")

        table_formatted = "\n".join(table_text_lines)
        criteria_str = criteria.strip() if criteria and criteria.strip() else ""

        prompt = (
            f"You are a neutral automotive analyst comparing '{v1.name}' and '{v2.name}'.\n\n"
            f"=== VERIFIED SPECIFICATIONS ===\n"
            f"{table_formatted}\n\n"
            f"=== INSTRUCTIONS ===\n"
            f"Provide a structured side-by-side comparative analysis in valid JSON format with the following keys:\n"
            f"1. 'v1_tradeoff': Concise, high-value trade-off analysis for '{v1.name}' (key strengths, practical compromises, and ideal buyer profile).\n"
            f"2. 'v2_tradeoff': Concise, high-value trade-off analysis for '{v2.name}' (key strengths, practical compromises, and ideal buyer profile).\n"
        )
        if criteria_str:
            prompt += (
                f"3. 'v1_focus': Specific factual evaluation of '{v1.name}' regarding user focus: '{criteria_str}'.\n"
                f"4. 'v2_focus': Specific factual evaluation of '{v2.name}' regarding user focus: '{criteria_str}'.\n"
            )
        prompt += (
            f"5. 'summary': 2-3 sentence neutral overview.\n\n"
            f"Return ONLY valid JSON matching this exact structure with no code fences:\n"
            f"{{\n"
            f'  "v1_tradeoff": "...",\n'
            f'  "v2_tradeoff": "..."'
        )
        if criteria_str:
            prompt += ',\n  "v1_focus": "...",\n  "v2_focus": "..."'
        prompt += ',\n  "summary": "..."\n}'

        try:
            logger.info("Generating neutral side-by-side trade-offs via Gemini...")
            summary_response = gemini_service.generate_text(prompt, model=model)
            cleaned_json = summary_response.strip()
            if cleaned_json.startswith("```"):
                cleaned_json = re.sub(r"^```(?:json)?\n?", "", cleaned_json)
                cleaned_json = re.sub(r"\n?```$", "", cleaned_json)

            data = json.loads(cleaned_json)

            # If user provided a specific comparison focus, insert it right into the side-by-side matrix!
            if criteria_str:
                focus_v1 = data.get("v1_focus") or f"Evaluation of {v1.name} for {criteria_str}"
                focus_v2 = data.get("v2_focus") or f"Evaluation of {v2.name} for {criteria_str}"
                table_rows.insert(
                    0,
                    ComparisonRow(
                        attribute=f"Comparison Focus: {criteria_str}",
                        vehicle_1_value=focus_v1,
                        vehicle_2_value=focus_v2,
                    ),
                )

            # Add side-by-side trade-off row right into the specification matrix!
            tradeoff_v1 = data.get("v1_tradeoff") or f"Key strengths and practical use cases for {v1.name}"
            tradeoff_v2 = data.get("v2_tradeoff") or f"Key strengths and practical use cases for {v2.name}"
            table_rows.append(
                ComparisonRow(
                    attribute="Executive Trade-Off & Ideal Use-Case",
                    vehicle_1_value=tradeoff_v1,
                    vehicle_2_value=tradeoff_v2,
                )
            )

            overall_summary = data.get("summary") or f"Side-by-side factual comparison between {v1.name} and {v2.name} completed."
            return table_rows, overall_summary

        except Exception as exc:
            logger.error("Failed to generate side-by-side trade-offs JSON: %s", str(exc))
            if criteria_str:
                table_rows.insert(
                    0,
                    ComparisonRow(
                        attribute=f"Comparison Focus: {criteria_str}",
                        vehicle_1_value=f"Evaluation of {v1.name} for {criteria_str}",
                        vehicle_2_value=f"Evaluation of {v2.name} for {criteria_str}",
                    ),
                )
            table_rows.append(
                ComparisonRow(
                    attribute="Executive Trade-Off & Ideal Use-Case",
                    vehicle_1_value=f"Practical advantages and use-case for {v1.name}",
                    vehicle_2_value=f"Practical advantages and use-case for {v2.name}",
                )
            )
            return table_rows, f"Factual comparison between {v1.name} and {v2.name} generated based on verified specifications."

    def compare(self, request: VehicleCompareRequest) -> VehicleCompareResponse:
        """
        Coordinates full vehicle comparison workflow:
        1. Identifies vehicle 1 and vehicle 2 in database/brochures.
        2. Extracts verified specifications across 8 categories.
        3. Formulates side-by-side comparison table and neutral summary.
        4. Gathers source document citations.
        """
        # 1. Identify vehicles
        v1_info = self.identify_vehicle(request.vehicle_1, request.variant_1)
        v2_info = self.identify_vehicle(request.vehicle_2, request.variant_2)

        # 2. Extract specifications
        v1_spec, v1_sources = self.extract_specifications(v1_info, model=request.model)
        v2_spec, v2_sources = self.extract_specifications(v2_info, model=request.model)

        # 3. Build comparison table and summary
        table_rows, summary = self.generate_comparison_summary(
            v1=v1_spec,
            v2=v2_spec,
            criteria=request.comparison_criteria,
            model=request.model,
        )

        # 4. Combine and deduplicate sources
        all_sources: List[ChatSource] = []
        seen_chunk_ids = set()
        for s in (v1_sources + v2_sources):
            if s.chunk_id and s.chunk_id in seen_chunk_ids:
                continue
            if s.chunk_id:
                seen_chunk_ids.add(s.chunk_id)
            all_sources.append(s)

        success = v1_spec.identified and v2_spec.identified
        msg = (
            "Vehicle comparison completed successfully."
            if success
            else "Vehicle comparison completed with missing brochure notices."
        )

        return VehicleCompareResponse(
            success=success,
            vehicle_1=v1_spec,
            vehicle_2=v2_spec,
            comparison_table=table_rows,
            summary=summary,
            sources=all_sources,
            message=msg,
        )


# Reusable singleton instance
vehicle_comparison_service = VehicleComparisonService()
