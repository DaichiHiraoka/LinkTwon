# Deployment Documents

Deployment and environment-operation documents live here.

- [Deployment configuration](DEPLOYMENT.md)
- [Environment management](environment.md)

The following deployment-related files stay in their conventional locations because the deployment platforms or local tools read them from there:

- `render.yaml`: Render Blueprint expects it at the repository root.
- `frontend/vercel.json`: Vercel reads it from the frontend project root.
- `frontend-admin/vercel.json`: Vercel reads it from the admin frontend project root.
- `.env.example` and service `.env.example` files: kept next to the services they document for local setup.
