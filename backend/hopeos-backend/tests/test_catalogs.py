"""Tests for catalog endpoints."""
import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


class TestCatalogs:
    """Test catalog endpoints."""

    @pytest.mark.asyncio
    async def test_initialize_catalogs(self, client: AsyncClient, admin_token):
        """Test initializing catalogs."""
        response = await client.post(
            "/catalogs/initialize",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        assert data["stats"]["medications"] > 0
        assert data["stats"]["lab_tests"] > 0
        assert data["stats"]["diagnoses"] > 0

    @pytest.mark.asyncio
    async def test_get_medications_catalog(self, client: AsyncClient, admin_token):
        """Test getting medication catalog."""
        # Initialize first
        await client.post("/catalogs/initialize", headers=auth_header(admin_token))

        response = await client.get(
            "/catalogs/medications",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        assert all("name" in med for med in data)

    @pytest.mark.asyncio
    async def test_get_lab_tests_catalog(self, client: AsyncClient, admin_token):
        """Test getting lab tests catalog."""
        # Initialize first
        await client.post("/catalogs/initialize", headers=auth_header(admin_token))

        response = await client.get(
            "/catalogs/lab-tests",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0

    @pytest.mark.asyncio
    async def test_get_diagnoses_catalog(self, client: AsyncClient, admin_token):
        """Test getting diagnoses catalog."""
        # Initialize first
        await client.post("/catalogs/initialize", headers=auth_header(admin_token))

        response = await client.get(
            "/catalogs/diagnoses",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0

    @pytest.mark.asyncio
    async def test_initialize_catalogs_requires_admin(self, client: AsyncClient, doctor_token):
        """Test that only admin can initialize catalogs."""
        response = await client.post(
            "/catalogs/initialize",
            headers=auth_header(doctor_token),
        )
        assert response.status_code == 403
