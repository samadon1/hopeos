"""Tests for patient endpoints."""
import pytest
from httpx import AsyncClient
from datetime import date

from tests.conftest import auth_header


class TestPatientCRUD:
    """Test patient CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_patient(self, client: AsyncClient, admin_token):
        """Test creating a new patient."""
        patient_data = {
            "first_name": "Kwame",
            "last_name": "Asante",
            "gender": "male",
            "birthdate": "1990-05-15",
            "phone_number": "+233201234567",
            "community": "Accra Central",
        }
        response = await client.post(
            "/patients",
            json=patient_data,
            headers=auth_header(admin_token),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["first_name"] == "Kwame"
        assert data["last_name"] == "Asante"
        assert data["identifier"] is not None  # Auto-generated
        assert len(data["identifier"]) == 7  # 6 digits + check digit

    @pytest.mark.asyncio
    async def test_get_patient(self, client: AsyncClient, admin_token):
        """Test getting a patient by ID."""
        # First create a patient
        patient_data = {
            "first_name": "Ama",
            "last_name": "Mensah",
            "gender": "female",
            "birthdate": "1985-03-20",
        }
        create_response = await client.post(
            "/patients",
            json=patient_data,
            headers=auth_header(admin_token),
        )
        patient_id = create_response.json()["id"]

        # Then get the patient
        response = await client.get(
            f"/patients/{patient_id}",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "Ama"
        assert data["last_name"] == "Mensah"

    @pytest.mark.asyncio
    async def test_get_patient_not_found(self, client: AsyncClient, admin_token):
        """Test getting a non-existent patient."""
        response = await client.get(
            "/patients/nonexistent-id",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_patient(self, client: AsyncClient, admin_token):
        """Test updating a patient."""
        # Create patient
        patient_data = {
            "first_name": "Kofi",
            "last_name": "Boateng",
            "gender": "male",
            "birthdate": "1992-08-10",
        }
        create_response = await client.post(
            "/patients",
            json=patient_data,
            headers=auth_header(admin_token),
        )
        patient_id = create_response.json()["id"]

        # Update patient
        update_data = {
            "phone_number": "+233209876543",
            "community": "Kumasi",
        }
        response = await client.put(
            f"/patients/{patient_id}",
            json=update_data,
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["phone_number"] == "+233209876543"
        assert data["community"] == "Kumasi"
        assert data["first_name"] == "Kofi"  # Unchanged

    @pytest.mark.asyncio
    async def test_delete_patient_as_admin(self, client: AsyncClient, admin_token):
        """Test admin can delete a patient."""
        # Create patient
        patient_data = {
            "first_name": "Test",
            "last_name": "Patient",
            "gender": "male",
            "birthdate": "2000-01-01",
        }
        create_response = await client.post(
            "/patients",
            json=patient_data,
            headers=auth_header(admin_token),
        )
        patient_id = create_response.json()["id"]

        # Delete patient
        response = await client.delete(
            f"/patients/{patient_id}",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(
            f"/patients/{patient_id}",
            headers=auth_header(admin_token),
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_patient_as_doctor_forbidden(self, client: AsyncClient, admin_token, doctor_token):
        """Test doctor cannot delete a patient."""
        # Create patient as admin
        patient_data = {
            "first_name": "Test",
            "last_name": "Patient",
            "gender": "female",
            "birthdate": "1995-06-15",
        }
        create_response = await client.post(
            "/patients",
            json=patient_data,
            headers=auth_header(admin_token),
        )
        patient_id = create_response.json()["id"]

        # Try to delete as doctor
        response = await client.delete(
            f"/patients/{patient_id}",
            headers=auth_header(doctor_token),
        )
        assert response.status_code == 403


class TestPatientList:
    """Test patient listing and search."""

    @pytest.mark.asyncio
    async def test_list_patients(self, client: AsyncClient, admin_token):
        """Test listing patients."""
        # Create a few patients
        for i in range(3):
            await client.post(
                "/patients",
                json={
                    "first_name": f"Patient{i}",
                    "last_name": "Test",
                    "gender": "male",
                    "birthdate": f"199{i}-01-01",
                },
                headers=auth_header(admin_token),
            )

        response = await client.get("/patients", headers=auth_header(admin_token))
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "count" in data
        assert "total_count" in data
        assert data["count"] >= 3

    @pytest.mark.asyncio
    async def test_list_patients_with_community_filter(self, client: AsyncClient, admin_token):
        """Test filtering patients by community."""
        # Create patients in different communities
        await client.post(
            "/patients",
            json={
                "first_name": "Accra",
                "last_name": "Patient",
                "gender": "male",
                "birthdate": "1990-01-01",
                "community": "Accra",
            },
            headers=auth_header(admin_token),
        )
        await client.post(
            "/patients",
            json={
                "first_name": "Kumasi",
                "last_name": "Patient",
                "gender": "female",
                "birthdate": "1991-01-01",
                "community": "Kumasi",
            },
            headers=auth_header(admin_token),
        )

        # Filter by community
        response = await client.get(
            "/patients?community=Accra",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        for patient in data["results"]:
            assert patient["community"] == "Accra"

    @pytest.mark.asyncio
    async def test_search_patients(self, client: AsyncClient, admin_token):
        """Test searching patients."""
        # Create a patient
        await client.post(
            "/patients",
            json={
                "first_name": "UniqueSearchName",
                "last_name": "TestSearch",
                "gender": "male",
                "birthdate": "1988-07-22",
            },
            headers=auth_header(admin_token),
        )

        # Search by name
        response = await client.get(
            "/patients/search?q=UniqueSearchName",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(p["first_name"] == "UniqueSearchName" for p in data)

    @pytest.mark.asyncio
    async def test_get_communities(self, client: AsyncClient, admin_token):
        """Test getting list of communities."""
        # Create patients with communities
        for community in ["Accra", "Kumasi", "Tamale"]:
            await client.post(
                "/patients",
                json={
                    "first_name": "Test",
                    "last_name": community,
                    "gender": "male",
                    "birthdate": "1990-01-01",
                    "community": community,
                },
                headers=auth_header(admin_token),
            )

        response = await client.get(
            "/patients/communities",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        communities = response.json()
        assert "Accra" in communities
        assert "Kumasi" in communities
        assert "Tamale" in communities


class TestPatientAge:
    """Test patient age calculation."""

    @pytest.mark.asyncio
    async def test_patient_age_in_response(self, client: AsyncClient, admin_token):
        """Test that age is correctly calculated in response."""
        # Create patient born 30 years ago
        from datetime import date, timedelta
        thirty_years_ago = date.today() - timedelta(days=30*365)

        response = await client.post(
            "/patients",
            json={
                "first_name": "Age",
                "last_name": "Test",
                "gender": "male",
                "birthdate": thirty_years_ago.isoformat(),
            },
            headers=auth_header(admin_token),
        )
        assert response.status_code == 201
        data = response.json()
        # Age should be approximately 30 (might be 29 or 30 depending on exact date)
        assert 29 <= data["age"] <= 31
