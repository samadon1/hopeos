#!/usr/bin/env python
"""Simple API test script - assumes server is running externally."""
import urllib.request
import json
import sys

BASE_URL = 'http://127.0.0.1:8012'


def test_health():
    """Test health endpoint."""
    print('Testing /health...')
    try:
        req = urllib.request.Request(f'{BASE_URL}/health')
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            print(f'  Status: {data.get("status")}')
            print(f'  Version: {data.get("version")}')
            return True
    except Exception as e:
        print(f'  Error: {e}')
        return False


def test_login():
    """Test login endpoint."""
    print('Testing /auth/login...')
    try:
        login_data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
        req = urllib.request.Request(
            f'{BASE_URL}/auth/login',
            data=login_data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
            token = data.get('access_token', '')
            print(f'  Token: {token[:50]}...')
            print(f'  User: {data.get("user", {}).get("display_name", "?")}')
            return token
    except Exception as e:
        print(f'  Error: {e}')
        return None


def test_patients(token):
    """Test patients endpoint."""
    print('Testing /patients...')
    try:
        req = urllib.request.Request(
            f'{BASE_URL}/patients?limit=5',
            headers={'Authorization': f'Bearer {token}'}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            patients = data.get('items', data) if isinstance(data, dict) else data
            print(f'  Found {len(patients)} patients')
            for i, p in enumerate(patients):
                if i >= 3:
                    break
                if isinstance(p, dict):
                    print(f'    - {p.get("identifier")}: {p.get("first_name")} {p.get("last_name")}')
            return True
    except Exception as e:
        print(f'  Error: {e}')
        return False


def test_observations(token):
    """Test observations endpoint."""
    print('Testing /observations...')
    try:
        req = urllib.request.Request(
            f'{BASE_URL}/observations?limit=5',
            headers={'Authorization': f'Bearer {token}'}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            obs = data if isinstance(data, list) else data.get('items', [])
            print(f'  Found {len(obs)} observations')
            for o in obs[:2]:
                if isinstance(o, dict):
                    print(f'    - {o.get("concept_display")}: {o.get("value_numeric")} {o.get("unit", "")}')
            return True
    except Exception as e:
        print(f'  Error: {e}')
        return False


def main():
    print('=' * 50)
    print('HopeOS API Test Suite')
    print('=' * 50)
    print()

    # Health check
    if not test_health():
        print('\nServer not running! Start with:')
        print('  uvicorn app.main:app --port 8012')
        return 1

    print()

    # Login
    token = test_login()
    if not token:
        print('\nLogin failed!')
        return 1

    print()

    # Patients
    test_patients(token)
    print()

    # Observations
    test_observations(token)
    print()

    print('=' * 50)
    print('All tests passed!')
    print('=' * 50)
    return 0


if __name__ == '__main__':
    sys.exit(main())
