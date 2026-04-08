"""Test script to verify the FastAPI server works."""
import multiprocessing
import time
import urllib.request
import json
import sys


def run_server():
    """Run the uvicorn server."""
    import uvicorn
    uvicorn.run('app.main:app', host='127.0.0.1', port=8012, log_level='info')


def test_endpoints():
    """Test the API endpoints."""
    print('Testing endpoints...')

    # Health check
    try:
        req = urllib.request.Request('http://127.0.0.1:8012/health')
        with urllib.request.urlopen(req, timeout=3) as resp:
            print(f'Health: {resp.read().decode()}')
    except Exception as e:
        print(f'Health check error: {e}')
        return False

    # Login
    try:
        login_data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
        req = urllib.request.Request(
            'http://127.0.0.1:8012/auth/login',
            data=login_data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            result = json.loads(resp.read().decode())
            print(f'Login: Got token {result["access_token"][:50]}...')

            # Get patients
            req2 = urllib.request.Request(
                'http://127.0.0.1:8012/patients?limit=3',
                headers={'Authorization': f'Bearer {result["access_token"]}'}
            )
            with urllib.request.urlopen(req2, timeout=3) as resp2:
                data = json.loads(resp2.read().decode())
                # Handle paginated response
                patients = data.get('items', data) if isinstance(data, dict) else data
                print(f'Patients: Found {len(patients)} patients')
                for pat in patients:
                    if isinstance(pat, dict):
                        print(f'  - {pat.get("identifier", "?")}: {pat.get("first_name", "?")} {pat.get("last_name", "?")}')
    except Exception as e:
        print(f'API Error: {e}')
        return False

    return True


def wait_for_server(url, timeout=30):
    """Wait for server to be ready."""
    import socket
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=1) as resp:
                return True
        except:
            time.sleep(0.5)
    return False


if __name__ == '__main__':
    # Use fork instead of spawn on macOS
    multiprocessing.set_start_method('fork')

    # Start server process
    p = multiprocessing.Process(target=run_server)
    p.start()

    print('Waiting for server to start...')
    if wait_for_server('http://127.0.0.1:8012/health', timeout=15):
        print('Server is ready!')
        # Run tests
        success = test_endpoints()
    else:
        print('Server failed to start within timeout')
        success = False

    # Cleanup
    p.terminate()
    p.join()
    print('Server stopped.')

    sys.exit(0 if success else 1)
