#!/usr/bin/env python3
"""
Test script to directly test Gemma model for analytics SQL generation.
Tests: 1. How long it takes  2. If it hangs
"""

import time
import sys

# Add app to path
sys.path.insert(0, '/Users/mac/Downloads/Work/Gamma/openmrs-distro-referenceapplication/HopeOS/backend/hopeos-backend')

print("=" * 60)
print("ANALYTICS AI TEST - Direct Gemma Model Test")
print("=" * 60)

# Database schema (same as in ai_service.py)
DATABASE_SCHEMA = """
Database Schema for HopeOS EHR System:

TABLES:
1. patients - Patient demographics
   - id (UUID, PK), identifier, first_name, last_name
   - gender, birthdate, phone_number, community
   - created_at, updated_at

2. visits - Patient visits
   - id (UUID, PK), patient_id (FK), visit_type, location
   - start_datetime, status (planned/in-progress/finished)

3. diagnoses - Patient conditions
   - id (UUID, PK), patient_id (FK), condition_text, condition_code
   - certainty (presumed/confirmed), diagnosed_date

4. medications - Prescriptions
   - id (UUID, PK), patient_id (FK), drug_name, dosage, frequency
   - status (active/completed/stopped)

5. lab_orders - Laboratory tests
   - id (UUID, PK), patient_id (FK), test_type
   - status (pending/completed), result_value
"""

def test_model():
    print("\n[1] Loading model...")
    start_load = time.time()

    from llama_cpp import Llama

    model_path = "/Users/mac/Downloads/Work/Gamma/openmrs-distro-referenceapplication/HopeOS/backend/hopeos-backend/models/gemma-4-E2B-it-Q3_K_S.gguf"

    llm = Llama(
        model_path=model_path,
        n_ctx=2048,
        n_gpu_layers=-1,
        n_batch=512,
        flash_attn=False,
        verbose=False,
    )

    load_time = time.time() - start_load
    print(f"    Model loaded in {load_time:.2f}s")

    # Test questions
    questions = [
        "How many patients do we have?",
        "Count patients by gender",
        "Show visits from last week",
    ]

    for i, question in enumerate(questions, 1):
        print(f"\n[{i+1}] Testing: '{question}'")
        print("-" * 50)

        prompt = f"""Tables: patients(id,gender,birthdate), visits(id,patient_id,status), diagnoses(id,patient_id,condition_text), medications(id,patient_id,drug_name,status), lab_orders(id,patient_id,test_type,status)

Question: {question}
Return JSON only: {{"sql": "SELECT...", "chart": {{"type": "bar"}}}}"""

        messages = [{"role": "user", "content": prompt}]

        print("    Sending to model...")
        start_gen = time.time()

        try:
            response = llm.create_chat_completion(
                messages=messages,
                max_tokens=500,
                temperature=0.3,
            )

            gen_time = time.time() - start_gen
            content = response["choices"][0]["message"]["content"]

            print(f"    ✅ Response in {gen_time:.2f}s")
            print(f"    Response: {content[:200]}...")

        except Exception as e:
            gen_time = time.time() - start_gen
            print(f"    ❌ Error after {gen_time:.2f}s: {e}")

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    test_model()
