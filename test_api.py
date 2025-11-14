#!/usr/bin/env python
import requests
import json

# Login
login_response = requests.post(
    'http://localhost:8000/api/v1/auth/login/form',
    data={'username': 'admin@test.com', 'password': 'Test@1234'},
    headers={'Content-Type': 'application/x-www-form-urlencoded'}
)

if login_response.status_code != 200:
    print(f"Login failed: {login_response.status_code}")
    print(login_response.text)
    exit(1)

data = login_response.json()
token = data['access_token']
print(f"✓ Login successful! Token: {token[:50]}...")

# Test settings endpoint
headers = {'Authorization': f'Bearer {token}'}
settings_response = requests.get('http://localhost:8000/api/v1/settings/me', headers=headers)

print(f"\n✓ User Settings Endpoint: {settings_response.status_code}")
print(json.dumps(settings_response.json(), indent=2))

# Test permissions endpoint
perm_response = requests.get('http://localhost:8000/api/v1/permissions', headers=headers)
print(f"\n✓ Permissions Endpoint: {perm_response.status_code}")
data = perm_response.json()
print(f"Total permissions: {data.get('total', 'N/A')}")
print(f"Permissions: {data.get('items', [])[0:3] if data.get('items') else 'None'}")
