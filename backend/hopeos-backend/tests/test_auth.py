"""Tests for authentication endpoints."""
import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


class TestLogin:
    """Test login endpoint."""

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, admin_user):
        """Test successful login."""
        response = await client.post(
            "/auth/login",
            json={"username": "testadmin", "password": "testpass123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, admin_user):
        """Test login with wrong password."""
        response = await client.post(
            "/auth/login",
            json={"username": "testadmin", "password": "wrongpass"},
        )
        assert response.status_code == 401
        assert "Invalid username or password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login with nonexistent user."""
        response = await client.post(
            "/auth/login",
            json={"username": "nobody", "password": "testpass123"},
        )
        assert response.status_code == 401


class TestCurrentUser:
    """Test /auth/me endpoint."""

    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, admin_user, admin_token):
        """Test getting current user info."""
        response = await client.get("/auth/me", headers=auth_header(admin_token))
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testadmin"
        assert data["role"] == "admin"
        assert data["display_name"] == "Test Admin"

    @pytest.mark.asyncio
    async def test_get_current_user_no_token(self, client: AsyncClient):
        """Test accessing protected endpoint without token."""
        response = await client.get("/auth/me")
        assert response.status_code == 401  # No auth header (401 = not authenticated)

    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self, client: AsyncClient):
        """Test accessing protected endpoint with invalid token."""
        response = await client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert response.status_code == 401


class TestProtectedRoutes:
    """Test role-based access control."""

    @pytest.mark.asyncio
    async def test_admin_only_route_as_admin(self, client: AsyncClient, admin_token):
        """Test admin can access admin-only routes."""
        response = await client.get("/users", headers=auth_header(admin_token))
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_only_route_as_doctor(self, client: AsyncClient, doctor_token):
        """Test doctor cannot access admin-only routes."""
        response = await client.get("/users", headers=auth_header(doctor_token))
        assert response.status_code == 403
        assert "Insufficient permissions" in response.json()["detail"]
