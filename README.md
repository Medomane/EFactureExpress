# E-Facture Express

**E-Facture Express** is a lightweight SaaS platform built for Moroccan SMEs to generate and manage electronic invoices in compliance with the 2026 DGI e-facturation law.

This MVP provides a full-stack implementation with a .NET 8 Web API, React frontend, and MinIO-based PDF storage—all fully containerized for fast deployment.

---

## 🚀 Features

- ✅ Secure JWT-based authentication
- ✅ Create, edit, delete invoices
- ✅ Import invoices via CSV
- ✅ Auto-generate and store PDF versions (QuestPDF + MinIO)
- ✅ Track invoices per authenticated user
- ✅ Proxy-based frontend → backend API routing (via Nginx)
- ✅ Docker Compose setup for full local stack

---

## 🧱 Tech Stack

- **Backend:** .NET 8 Minimal APIs, Entity Framework Core, FluentValidation
- **Frontend:** React + TypeScript, Tailwind CSS, Nginx
- **PDFs:** QuestPDF
- **Storage:** MinIO (S3-compatible object storage)
- **DevOps:** Docker, Docker Compose

---

## 🧪 Running Locally

```bash
git clone https://github.com/your-org/efacture-express.git
cd efacture-express
docker compose up -d --build
```

Once the containers are running:

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:5000](http://localhost:5000)

You're ready to start invoicing!

---

## Environment Variables

The API pulls sensitive settings from environment variables. Create a `.env` file
or set them in your hosting environment. An example configuration is provided in
[`.env.example`](./.env.example).

| Variable | Description |
| --- | --- |
| `DEFAULT_CONNECTION` | Database connection string |
| `MINIO_ENDPOINT` | MinIO server address |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `MINIO_BUCKET_NAME` | Bucket for storing invoice PDFs |
| `JWT_KEY` | Secret used to sign JWT tokens |
| `JWT_ISSUER` | JWT issuer value |
| `JWT_AUDIENCE` | Audience for generated JWT tokens |

---

## License

This project is licensed under the [MIT License](LICENSE).
