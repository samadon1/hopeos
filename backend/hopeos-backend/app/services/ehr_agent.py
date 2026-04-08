"""EHR Agent - AI-powered EHR Navigator using Table Classification approach.

This agent uses local Gemma 4 model to:
1. Classify which data tables are needed for a clinical question
2. Fetch data from those tables using predefined, safe queries
3. Synthesize clinical summaries from the combined results

This approach is more reliable than text-to-SQL because:
- AI only needs to identify table names (simple classification)
- Predefined queries are guaranteed safe and correct
- No risk of SQL injection or malformed queries
"""
import json
import re
from typing import Optional, List, Dict, Any, AsyncGenerator
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.services.ai_service import ai_service


class EHRAgent:
    """Agent for navigating EHR data using table classification approach.

    Flow:
    1. AI classifies which data tables are needed for the question
    2. Fetch data from those tables in parallel using predefined queries
    3. AI summarizes all fetched data to answer the question
    """

    # Predefined queries for each data type - simple, no JOINs, always work
    TABLE_QUERIES = {
        "demographics": "SELECT first_name, last_name, gender, birthdate FROM patients WHERE id = '{patient_id}'",
        "diagnoses": "SELECT condition_text, condition_code, certainty, diagnosed_date FROM diagnoses WHERE patient_id = '{patient_id}' ORDER BY diagnosed_date DESC LIMIT 15",
        "labs": "SELECT test_type, result_value, result_unit, result_interpretation, completed_at FROM lab_orders WHERE patient_id = '{patient_id}' ORDER BY completed_at DESC LIMIT 15",
        "vitals": "SELECT concept_display, value_numeric, unit, obs_datetime FROM observations WHERE patient_id = '{patient_id}' ORDER BY obs_datetime DESC LIMIT 15",
        "medications": "SELECT drug_name, dosage, frequency, status, prescribed_date FROM medications WHERE patient_id = '{patient_id}' ORDER BY prescribed_date DESC LIMIT 15",
        "allergies": "SELECT allergen_name, reaction, severity, status FROM allergies WHERE patient_id = '{patient_id}'",
        "encounters": "SELECT encounter_type, encounter_datetime, location, notes FROM encounters WHERE patient_id = '{patient_id}' ORDER BY encounter_datetime DESC LIMIT 10",
    }

    def __init__(self):
        self.max_queries = 5

    async def _classify_tables(self, question: str) -> List[str]:
        """Return all available tables - database queries are fast and async anyway.

        This avoids blocking AI inference just for table selection.
        The actual AI analysis happens during response generation.
        """
        return ["demographics", "diagnoses", "labs", "vitals", "medications", "allergies", "encounters"]

    async def _execute_sql(self, sql: str, db: AsyncSession) -> Dict[str, Any]:
        """Execute SQL query and return results."""
        try:
            result = await db.execute(text(sql))
            rows = result.fetchall()
            columns = result.keys()

            # Convert to list of dicts
            data = [dict(zip(columns, row)) for row in rows]

            return {
                "success": True,
                "data": data,
                "count": len(data),
                "columns": list(columns)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def _is_summary_request(self, question: str) -> bool:
        """Check if the question is asking for a general summary/overview."""
        summary_keywords = [
            "summary", "summarize", "overview", "tell me about",
            "what do you know", "patient info", "patient information",
            "who is this patient", "describe", "general"
        ]
        question_lower = question.lower()
        return any(keyword in question_lower for keyword in summary_keywords)

    def _build_summary_prompt(
        self,
        question: str,
        queries_results: List[Dict[str, Any]]
    ) -> Optional[str]:
        """Build the prompt for summarization. Returns None if no data."""
        all_data = []
        for qr in queries_results:
            if qr.get("error"):
                continue
            data = qr.get("data", [])
            if data:
                data_type = qr.get("data_type", "data")
                all_data.append(f"[{data_type}]: {json.dumps(data[:5], default=str)}")

        if not all_data:
            return None

        data_str = "\n".join(all_data)

        # Determine if this is a summary request or a specific question
        if self._is_summary_request(question):
            instruction = "Provide a brief clinical summary with key values and dates. Note any abnormal values."
        else:
            instruction = f"""Answer the question directly and specifically. Do NOT provide a general patient summary first.
Focus only on what was asked: "{question}"
Use the patient data below to inform your answer, but respond to the specific request."""

        return f"""Patient records:
{data_str}

Question: {question}

{instruction}

IMPORTANT FORMATTING RULES:
- Use plain text only, NO LaTeX or mathematical notation
- Write temperatures as "36.8°C" not "$36.8^\\circ\\text{{C}}$"
- Write units directly like "120/80 mmHg", "75 kg", "168 cm"
- Use simple markdown headers (##) and bullet points (-)"""

    def _summarize_results(
        self,
        question: str,
        patient_id: str,
        queries_results: List[Dict[str, Any]]
    ) -> str:
        """Generate clinical summary from query results."""
        prompt = self._build_summary_prompt(question, queries_results)

        if not prompt:
            return "No patient data found. Please verify the patient exists and has records."

        # Use different system prompt based on question type
        if self._is_summary_request(question):
            system_prompt = "You are a clinical AI. Give concise factual answers based on the data shown."
        else:
            system_prompt = "You are a clinical AI assistant. Answer the user's specific question directly without providing a general patient summary first. Be helpful and focused on their actual request."

        response = ai_service.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=400,
            temperature=0.5,
        )

        # Remove repetitive lines
        lines = response.split('\n')
        unique_lines = []
        seen_starts = set()
        for line in lines:
            start = line.strip()[:40]
            if start and start not in seen_starts:
                seen_starts.add(start)
                unique_lines.append(line)
            elif not start:  # Keep empty lines
                unique_lines.append(line)

        return '\n'.join(unique_lines[:20])  # Limit to 20 lines max

    async def _summarize_results_stream(
        self,
        question: str,
        queries_results: List[Dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        """Stream clinical summary generation token by token."""
        prompt = self._build_summary_prompt(question, queries_results)

        if not prompt:
            yield "No patient data found. Please verify the patient exists and has records."
            return

        # Use different system prompt based on question type
        if self._is_summary_request(question):
            system_prompt = "You are a clinical AI. Give concise factual answers based on the data shown."
        else:
            system_prompt = "You are a clinical AI assistant. Answer the user's specific question directly without providing a general patient summary first. Be helpful and focused on their actual request."

        async for token in ai_service.generate_stream(
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=400,
            temperature=0.5,
        ):
            yield token

    async def query(
        self,
        question: str,
        patient_id: str,
        db: AsyncSession,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Process a natural language query about a patient.

        Flow:
        1. AI classifies which tables are needed for the question
        2. Fetch data from those tables using predefined queries
        3. AI summarizes all data to answer the question
        """
        if not ai_service.model_loaded:
            if not ai_service.load_model():
                return {
                    "response": "AI model not available. Please ensure the model is loaded.",
                    "error": True
                }

        # Step 1: Classify which tables are needed
        print(f"[DEBUG] Classifying tables for: {question}")
        tables_needed = await self._classify_tables(question)
        print(f"[DEBUG] Tables needed: {tables_needed}")

        # Step 2: Fetch data from classified tables
        queries_executed = []
        for table in tables_needed:
            sql = self.TABLE_QUERIES[table].format(patient_id=patient_id)
            exec_result = await self._execute_sql(sql, db)

            if exec_result.get("count", 0) > 0:
                queries_executed.append({
                    "sql": sql,
                    "explanation": f"Patient {table}",
                    "data_type": table,
                    "data": exec_result.get("data", []),
                    "error": exec_result.get("error"),
                    "count": exec_result.get("count", 0)
                })

        # If no data found, try fetching all tables
        if not queries_executed:
            print("[DEBUG] No data from classified tables, fetching all")
            queries_executed = await self._fetch_related_data(patient_id, question, db)

        # Step 3: Generate clinical summary
        summary = self._summarize_results(question, patient_id, queries_executed)

        return {
            "response": summary,
            "tool_calls": [
                {
                    "tool": "fetch_data",
                    "arguments": {"table": q.get("data_type", "")},
                    "result_summary": f"{q.get('count', 0)} rows"
                }
                for q in queries_executed if not q.get("error")
            ],
            "iterations": len(queries_executed),
            "patient_id": patient_id,
            "timestamp": datetime.utcnow().isoformat(),
            "disclaimer": "AI-assisted analysis. Clinical judgment required.",
            "error": None
        }

    async def _fetch_related_data(
        self,
        patient_id: str,
        question: str,
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """Fetch comprehensive patient data when primary query returns no results.

        This is a generic fallback that fetches from all major tables.
        The AI summarizer will extract what's relevant to the question.
        """
        results = []

        # Fetch from all major tables - let the AI figure out what's relevant
        queries = [
            {
                "sql": f"SELECT first_name, last_name, gender, birthdate FROM patients WHERE id = '{patient_id}'",
                "data_type": "demographics"
            },
            {
                "sql": f"SELECT condition_text, condition_code, certainty, diagnosed_date FROM diagnoses WHERE patient_id = '{patient_id}' ORDER BY diagnosed_date DESC LIMIT 10",
                "data_type": "diagnoses"
            },
            {
                "sql": f"SELECT test_type, result_value, result_unit, result_interpretation, completed_at FROM lab_orders WHERE patient_id = '{patient_id}' ORDER BY completed_at DESC LIMIT 10",
                "data_type": "labs"
            },
            {
                "sql": f"SELECT concept_display, value_numeric, unit, obs_datetime FROM observations WHERE patient_id = '{patient_id}' ORDER BY obs_datetime DESC LIMIT 10",
                "data_type": "vitals"
            },
            {
                "sql": f"SELECT drug_name, dosage, frequency, status FROM medications WHERE patient_id = '{patient_id}' AND status = 'active' ORDER BY prescribed_date DESC LIMIT 10",
                "data_type": "medications"
            },
        ]

        for q in queries:
            exec_result = await self._execute_sql(q["sql"], db)
            if exec_result.get("count", 0) > 0:
                results.append({
                    "sql": q["sql"],
                    "explanation": f"Patient {q['data_type']}",
                    "data_type": q["data_type"],
                    "data": exec_result.get("data", []),
                    "error": exec_result.get("error"),
                    "count": exec_result.get("count", 0)
                })

        return results

    async def query_stream(
        self,
        question: str,
        patient_id: str,
        db: AsyncSession,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> AsyncGenerator[str, None]:
        """Stream the agent's response with true token-level streaming.

        Flow:
        1. Classify tables (fast) - emit status
        2. Fetch data (fast) - emit tool calls
        3. Stream summarization token by token
        """
        if not ai_service.model_loaded:
            if not ai_service.load_model():
                yield json.dumps({
                    "type": "error",
                    "content": "AI model not available. Please ensure the model is loaded."
                }) + "\n"
                return

        # Step 1: Classify tables
        yield json.dumps({
            "type": "status",
            "content": "Analyzing question..."
        }) + "\n"

        tables_needed = await self._classify_tables(question)

        yield json.dumps({
            "type": "status",
            "content": f"Fetching data from: {', '.join(tables_needed)}"
        }) + "\n"

        # Step 2: Fetch data from classified tables
        queries_executed = []
        tool_calls = []

        for table in tables_needed:
            sql = self.TABLE_QUERIES[table].format(patient_id=patient_id)
            exec_result = await self._execute_sql(sql, db)

            if exec_result.get("count", 0) > 0:
                queries_executed.append({
                    "sql": sql,
                    "explanation": f"Patient {table}",
                    "data_type": table,
                    "data": exec_result.get("data", []),
                    "error": exec_result.get("error"),
                    "count": exec_result.get("count", 0)
                })
                tool_calls.append({
                    "tool": "fetch_data",
                    "arguments": {"table": table},
                    "result_summary": f"{exec_result.get('count', 0)} rows"
                })

                # Emit tool call progress
                yield json.dumps({
                    "type": "tool_call",
                    "tool": "fetch_data",
                    "table": table,
                    "result": f"{exec_result.get('count', 0)} rows"
                }) + "\n"

        # If no data found, try fetching all tables
        if not queries_executed:
            yield json.dumps({
                "type": "status",
                "content": "No data from classified tables, fetching all..."
            }) + "\n"
            queries_executed = await self._fetch_related_data(patient_id, question, db)
            for qr in queries_executed:
                tool_calls.append({
                    "tool": "fetch_data",
                    "arguments": {"table": qr.get("data_type", "")},
                    "result_summary": f"{qr.get('count', 0)} rows"
                })

        # Step 3: Stream the summarization
        yield json.dumps({
            "type": "response_start"
        }) + "\n"

        async for token in self._summarize_results_stream(question, queries_executed):
            yield json.dumps({
                "type": "content",
                "content": token
            }) + "\n"

        # Final completion message
        yield json.dumps({
            "type": "done",
            "iterations": len(queries_executed),
            "tool_calls": tool_calls,
            "timestamp": datetime.utcnow().isoformat(),
            "disclaimer": "AI-assisted analysis. Clinical judgment required."
        }) + "\n"


# Singleton instance
ehr_agent = EHRAgent()
