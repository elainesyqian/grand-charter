"""/api/auth

POST /login          LoginIn -> MeOut; sets session. Same 401 for unknown email and bad password.
POST /logout         clears session; 204.
GET  /me             MeOut; 401 if not signed in.
GET  /demo-users     list of seeded demo users for the login picker (no passwords returned).
"""
