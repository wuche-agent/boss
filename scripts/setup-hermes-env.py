#!/usr/bin/env python3
"""One-time script: read Hermes pm profile credentials and update .env"""
import json, re, os

profile_auth = os.path.expanduser('~/.hermes/profiles/pm/auth.json')
env_file = os.path.join(os.path.dirname(__file__), '..', '.env')

with open(profile_auth) as f:
    d = json.load(f)

cred = d['credential_pool']['custom:aiznt'][0]
base_url = cred['base_url']
api_key = cred['access_token']
model = 'qwen3.6-plus'

with open(env_file) as f:
    content = f.read()

def upsert(text, key, value):
    pattern = rf'^{key}=.*$'
    replacement = f'{key}={value}'
    if re.search(pattern, text, re.MULTILINE):
        return re.sub(pattern, replacement, text, flags=re.MULTILINE)
    return text + f'\n{replacement}'

content = upsert(content, 'HERMES_BASE_URL', base_url)
content = upsert(content, 'HERMES_MODEL', model)
content = upsert(content, 'HERMES_API_KEY', api_key)

with open(env_file, 'w') as f:
    f.write(content)

print(f"Done. HERMES_BASE_URL={base_url}, HERMES_MODEL={model}, HERMES_API_KEY=sk-****")
